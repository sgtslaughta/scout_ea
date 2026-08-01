<#
    Scout EA installer for Windows.

        irm https://<your-host>/install.ps1 | iex

    Installs WSL2 and Docker Desktop if they're missing, then downloads the
    compose file and starts Scout EA on this machine. Each person runs their
    own copy: their mail, tasks and notes stay in a SQLite file in their own
    profile, and Scout talks to it over localhost.

    Safe to run more than once. It skips whatever is already done, so after the
    reboot that WSL needs, running the same one-liner again picks up where it
    left off.
#>
[CmdletBinding()]
param(
    # Where to fetch install files from. GitHub, not any running dashboard --
    # a dashboard is somebody's dev instance and shouldn't be the thing every
    # laptop pulls its install from.
    #
    # Override with SCOUT_EA_SOURCE to install from a fork or a branch;
    # `irm <url> | iex` gives the script no way to take arguments.
    [string] $Source = $(if ($env:SCOUT_EA_SOURCE) { $env:SCOUT_EA_SOURCE }
                         else { 'https://raw.githubusercontent.com/sgtslaughta/scout_ea/main' }),
    [string] $InstallDir = (Join-Path $env:LOCALAPPDATA 'ScoutEA')
)

$ErrorActionPreference = 'Stop'

function Say    ($m) { Write-Host "  $m" }
function Step   ($m) { Write-Host "`n$m" -ForegroundColor Cyan }
function Ok     ($m) { Write-Host "  $m" -ForegroundColor Green }
function Warn   ($m) { Write-Host "  $m" -ForegroundColor Yellow }
function Fail   ($m) { Write-Host "`n$m" -ForegroundColor Red; exit 1 }

# --- preflight ---------------------------------------------------------------

# WSL2 needs Windows 10 2004 (build 19041) or newer. Checking up front beats
# failing halfway through a Docker Desktop install.
$build = [int](Get-CimInstance Win32_OperatingSystem).BuildNumber
if ($build -lt 19041) {
    Fail "This needs Windows 10 version 2004 or newer (you're on build $build). Ask IT to update Windows first."
}

$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
    Fail @"
This installer needs to run as administrator, because installing WSL and
Docker Desktop does.

Right-click Windows Terminal (or PowerShell), choose 'Run as administrator',
and paste the same command again.
"@
}

$Source = $Source.TrimEnd('/')

# --- 1. WSL ------------------------------------------------------------------

Step '1/4  Windows Subsystem for Linux'
$wslReady = $false
try {
    # `wsl --status` exits non-zero when WSL isn't installed. Redirect so its
    # noise doesn't look like our error.
    wsl.exe --status *> $null
    $wslReady = ($LASTEXITCODE -eq 0)
} catch { $wslReady = $false }

if ($wslReady) {
    Ok 'Already installed.'
} else {
    Say 'Installing (this takes a few minutes)...'
    # --no-distribution: Docker Desktop brings its own WSL image, so a full
    # Ubuntu install would be a large download the user never touches.
    wsl.exe --install --no-distribution
    if ($LASTEXITCODE -ne 0) { Fail 'WSL install failed. Check with IT that it is allowed on this machine.' }

    # Queue the same one-liner to run after the reboot, so the user doesn't
    # have to remember where they were.
    $resume = "irm $Source/install/install.ps1 | iex"
    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce' `
        -Name 'ScoutEAInstall' `
        -Value "powershell -NoExit -ExecutionPolicy Bypass -Command `"$resume`"" `
        -ErrorAction SilentlyContinue

    Write-Host "`nRestart your computer, then this will carry on by itself." -ForegroundColor Yellow
    $answer = Read-Host 'Restart now? (y/n)'
    if ($answer -eq 'y') { Restart-Computer -Force }
    exit 0
}

# --- 2. Docker Desktop -------------------------------------------------------

Step '2/4  Docker Desktop'
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Say 'Installing...'
    winget install --id Docker.DockerDesktop --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        Fail @"
Docker Desktop wouldn't install. That's usually company policy blocking it.

Send IT this: 'Please allow Docker Desktop (winget id Docker.DockerDesktop).'
"@
    }
    # winget doesn't refresh the current session's PATH.
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')
} else {
    Ok 'Already installed.'
}

Step '3/4  Starting Docker'
$desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
if (Test-Path $desktop) { Start-Process $desktop -ErrorAction SilentlyContinue }

# Docker Desktop takes a while to bring up its engine, and `docker compose`
# fails confusingly until it has. Wait for the engine rather than the process.
Say 'Waiting for Docker to be ready (up to 3 minutes)...'
$ready = $false
foreach ($i in 1..90) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    Fail @"
Docker didn't finish starting.

Open Docker Desktop from the Start menu, accept its terms if it asks, wait for
the whale icon to stop animating, then paste the same command again.
"@
}
Ok 'Docker is running.'

# --- 3. Config ---------------------------------------------------------------

Step '4/4  Scout EA'
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Invoke-WebRequest "$Source/install/docker-compose.yml" `
    -OutFile (Join-Path $InstallDir 'docker-compose.yml') -UseBasicParsing

# The token is what stops anything else on this machine talking to the MCP
# server. Generated once and kept -- regenerating it on every run would break
# the connection the user already set up in Scout.
$envFile = Join-Path $InstallDir '.env'
if (-not (Test-Path $envFile)) {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $token = [Convert]::ToBase64String($bytes)
    "EA_MCP_TOKEN=$token" | Set-Content -Path $envFile -Encoding ascii
    Say 'Created a private access token for this machine.'
} else {
    Say 'Keeping the existing access token.'
}

Push-Location $InstallDir
try {
    docker compose up -d
    if ($LASTEXITCODE -ne 0) { Fail "Scout EA did not start. Run 'docker compose logs' in $InstallDir" }
} finally { Pop-Location }

# --- done --------------------------------------------------------------------

$dashboard = 'http://localhost:8765'
Say 'Waiting for the dashboard...'
foreach ($i in 1..30) {
    try {
        Invoke-WebRequest "$dashboard/api/config" -UseBasicParsing -TimeoutSec 2 | Out-Null
        break
    } catch { Start-Sleep -Seconds 2 }
}

Write-Host ''
Ok 'Scout EA is running.'
Write-Host ''
Write-Host '  Next: the setup page will open. Follow the two steps on it.' -ForegroundColor Cyan
Write-Host "  From now on, your dashboard lives at $dashboard" -ForegroundColor Cyan
Write-Host ''
Start-Process $dashboard
