# Installing Scout EA on Windows

Open **Windows Terminal** or **PowerShell** as administrator — right-click it and
choose *Run as administrator* — then paste this and press Enter:

```powershell
irm https://raw.githubusercontent.com/sgtslaughta/scout_ea/main/install/install.ps1 | iex
```

That's it. The installer:

1. Installs Windows Subsystem for Linux, if it isn't already there
2. Installs Docker Desktop, if it isn't already there
3. Downloads Scout EA and starts it
4. Opens your dashboard at <http://localhost:8765>

**You'll be asked to restart once**, part way through — Windows needs it after
installing WSL. After the restart the installer carries on by itself. If it
doesn't, paste the same command again; it picks up where it left off.

Then follow the two steps on the setup page to connect Scout.

## If something goes wrong

**"This installer needs to run as administrator"** — you opened a normal
PowerShell window. Close it, right-click PowerShell, and pick *Run as
administrator*.

**"Docker Desktop wouldn't install"** — company policy is blocking it. Ask IT to
allow Docker Desktop; the winget package id is `Docker.DockerDesktop`.

**"Docker didn't finish starting"** — open Docker Desktop from the Start menu,
accept its terms if it asks, wait for the whale icon in the system tray to stop
animating, then run the command again.

**Anything else** — open PowerShell and run:

```powershell
cd $env:LOCALAPPDATA\ScoutEA
docker compose logs
```

## What gets installed where

| What | Where |
|---|---|
| Your data (mail, tasks, notes) | a Docker volume named `eadata`, on this machine |
| Compose file and access token | `%LOCALAPPDATA%\ScoutEA` |
| Dashboard | <http://localhost:8765> |
| MCP server Scout talks to | <http://localhost:8766> |

Everything stays on your own machine. Both ports listen on `127.0.0.1` only, so
nothing else on the network can reach them.

## Uninstalling

```powershell
cd $env:LOCALAPPDATA\ScoutEA
docker compose down -v          # -v also deletes your data
Remove-Item -Recurse $env:LOCALAPPDATA\ScoutEA
```

## Installing from a fork or branch

```powershell
$env:SCOUT_EA_SOURCE = 'https://raw.githubusercontent.com/<you>/scout_ea/<branch>'
irm $env:SCOUT_EA_SOURCE/install/install.ps1 | iex
```
