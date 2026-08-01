/**
 * Builds the one message a user pastes into Scout to install the whole setup:
 * skills, scheduled automations, and the MCP tool allow-list.
 *
 * Real layout of a Scout install (confirmed by listing one, `C:\Users\<user>\.scout\`
 * on Windows and `~/.scout/` on macOS):
 *
 *   m-skills/<name>/SKILL.md    user skills, plus skills-metadata.json + disabled-skills.json
 *   m-automations/automations.json   JSON array of automation definitions
 *   m-mcp-servers.json          {"servers": {"<key>": {builtin, config, tools[]}}}
 *
 * The root is `.scout`, NOT `.copilot`. Microsoft's published docs describe the
 * Copilot CLI layout; a real Scout install does not use it. Trust the machine.
 *
 * Everything here is mergeable plaintext except the MCP access token, which is
 * encrypted against ~/.scout/m-encryption-key.enc -- so the server entry has to
 * be created once through the UI, and we only ever extend its `tools` array.
 */

export const SKILLS_DIR = '~/.scout/m-skills'
export const AUTOMATIONS_PATH = '~/.scout/m-automations/automations.json'
export const MCP_SERVERS_PATH = '~/.scout/m-mcp-servers.json'

export interface BootstrapOptions {
  /** Origin the Scout machine can reach this server on. */
  baseUrl: string
  /** What the MCP server is named in Scout; substituted for {{mcp_name}}. */
  mcpName: string
}

/** Trailing slashes would produce `//api/...`, which some proxies 404. */
function normaliseBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

export function buildBootstrapPrompt({ baseUrl, mcpName }: BootstrapOptions): string {
  const base = normaliseBase(baseUrl)
  return `Set up my Scout EA install. Work through these in order and report what changed.

Fetch ${base}/api/scout/install once. It returns JSON with "skills",
"automations" and "mcpTools", already rendered for the MCP server named
"${mcpName}".

1. SKILLS -> ${SKILLS_DIR}/
   For each entry in "skills", write its "content" verbatim to
   ${SKILLS_DIR}/<path>. Create folders as needed and overwrite what's there —
   this server is the source of truth.

   Then open ${SKILLS_DIR}/skills-metadata.json. For any skill that has no
   entry, add one, copying the field names and shape of the entries already in
   that file. Don't invent fields it doesn't already use. Check
   ${SKILLS_DIR}/disabled-skills.json too and make sure none of these are
   listed there.

2. AUTOMATIONS -> ${AUTOMATIONS_PATH}
   Read the existing array first and keep a copy of it. For each entry in
   "automations", match on "id": replace the existing object if that id is
   already present, otherwise append. Never drop or reorder automations you
   didn't recognise, and preserve "pinnedSessionId" and "lastExecutedAt" on any
   entry you replace — those are yours, not ours.

3. MCP TOOLS -> ${MCP_SERVERS_PATH}
   Find the server whose config name matches "${mcpName}". Set its "tools"
   array to the union of what's there now and the "mcpTools" list. Change
   nothing else in that file — in particular leave "accessTokenEncrypted"
   exactly as it is.

   This step is the one that matters most: most of these skills are currently
   blocked because the tools they call aren't in that allow-list.

4. Report back: how many skills you wrote, how many registry entries you added,
   how many automations were added vs replaced, and which tool names were newly
   added to the allow-list.

Restart Scout if any of these files need a reload to take effect, and tell me if
so.`
}
