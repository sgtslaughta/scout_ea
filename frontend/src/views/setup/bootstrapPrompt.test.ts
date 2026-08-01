import { describe, it, expect } from 'vitest'
import {
  buildBootstrapPrompt, SKILLS_DIR, AUTOMATIONS_PATH, MCP_SERVERS_PATH,
} from './bootstrapPrompt'

const opts = { baseUrl: 'https://scoutdb.jmolabs.dev', mcpName: 'scout-ea' }

describe('buildBootstrapPrompt', () => {
  it('points Scout at the install bundle', () => {
    expect(buildBootstrapPrompt(opts)).toContain('https://scoutdb.jmolabs.dev/api/scout/install')
  })

  it('strips trailing slashes so the URL never doubles up', () => {
    const prompt = buildBootstrapPrompt({ ...opts, baseUrl: 'https://example.com///' })
    expect(prompt).toContain('https://example.com/api/scout/install')
    expect(prompt).not.toContain('//api/')
  })

  // The root is .scout, not .copilot -- Microsoft's docs describe the Copilot
  // CLI layout, which a real Scout install doesn't use.
  it('targets the three real config paths, never .copilot', () => {
    const prompt = buildBootstrapPrompt(opts)
    expect(prompt).toContain(SKILLS_DIR)
    expect(prompt).toContain(AUTOMATIONS_PATH)
    expect(prompt).toContain(MCP_SERVERS_PATH)
    expect(prompt).not.toContain('.copilot')
  })

  it('registers skills rather than only dropping folders', () => {
    const prompt = buildBootstrapPrompt(opts)
    expect(prompt).toContain('skills-metadata.json')
    expect(prompt).toContain('disabled-skills.json')
  })

  it('merges automations by id instead of overwriting the file', () => {
    const prompt = buildBootstrapPrompt(opts)
    expect(prompt).toMatch(/match on "id"/i)
    expect(prompt).toMatch(/pinnedSessionId/)
  })

  // Re-encrypting the token is impossible for us, and clobbering it would
  // silently disconnect the MCP server.
  it('protects the encrypted MCP token and only unions the tool list', () => {
    const prompt = buildBootstrapPrompt(opts)
    expect(prompt).toContain('accessTokenEncrypted')
    expect(prompt).toMatch(/union/i)
  })

  it('names the configured MCP server so the right entry is patched', () => {
    expect(buildBootstrapPrompt({ ...opts, mcpName: 'Scout EA MCP' }))
      .toContain('"Scout EA MCP"')
  })
})
