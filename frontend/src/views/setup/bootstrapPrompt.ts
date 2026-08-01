/**
 * Builds the one message a user pastes into Scout to install every skill.
 *
 * Scout reads custom skills from `~/.copilot/skills/<name>/SKILL.md` and picks
 * them up at the start of each conversation -- no restart, no per-skill UI step
 * (Microsoft Learn, Scout FAQ: "automatically discovers your custom skills").
 * So the whole copy-24-skills-by-hand flow collapses into Scout fetching them
 * from this server and writing the files itself.
 *
 * The second half asks Scout where automations and MCP config actually live.
 * Microsoft doesn't publish those paths, and we're not going to guess at the
 * on-disk format of a preview app -- we ask, then decide.
 */

/** Skills folder Scout reads. `~` is left for Scout to expand per-platform. */
export const SKILLS_DIR = '~/.copilot/skills'

export interface BootstrapOptions {
  /** Origin the Scout machine can reach this server on. */
  baseUrl: string
  /** What the MCP server is named in Scout; substituted for {{mcp_name}}. */
  mcpName: string
}

/** Trailing slashes would produce `//api/skills`, which some proxies 404. */
function normaliseBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

export function buildBootstrapPrompt({ baseUrl, mcpName }: BootstrapOptions): string {
  const base = normaliseBase(baseUrl)
  return `Install my Scout EA skills, then tell me how this machine is set up.

1. Fetch ${base}/api/skills — it returns a JSON array, one object per skill with
   "name", "description", "schedule" and "body".

2. For each skill, write ${SKILLS_DIR}/<name>/SKILL.md containing YAML
   frontmatter followed by the body:

   ---
   name: <name>
   description: <description>
   schedule: <schedule>
   ---

   <body>

   Replace every occurrence of {{mcp_name}} in the body with ${mcpName}.
   Create folders as needed and overwrite any file that's already there —
   this server is the source of truth for these skills.

3. Tell me how many skills you wrote, and list any that failed.

4. Then, without changing anything, show me:
   - a recursive listing of ~/.copilot (folders and file names only)
   - a listing of your application data folder
     (%APPDATA%\\Microsoft Scout\\ on Windows,
      ~/Library/Application Support/Microsoft Scout/ on macOS)
   - the contents of ~/.copilot/mcp-config.json if it exists

   I want to know where you store automations and MCP server config. Don't edit
   anything in step 4 — read only.`
}
