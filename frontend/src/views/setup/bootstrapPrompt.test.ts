import { describe, it, expect } from 'vitest'
import { buildBootstrapPrompt, SKILLS_DIR } from './bootstrapPrompt'

const opts = { baseUrl: 'https://scoutdb.jmolabs.dev', mcpName: 'scout-ea' }

describe('buildBootstrapPrompt', () => {
  it('points Scout at this server’s skills endpoint', () => {
    expect(buildBootstrapPrompt(opts)).toContain('https://scoutdb.jmolabs.dev/api/skills')
  })

  it('strips trailing slashes so the URL never doubles up', () => {
    const prompt = buildBootstrapPrompt({ ...opts, baseUrl: 'https://example.com///' })
    expect(prompt).toContain('https://example.com/api/skills')
    expect(prompt).not.toContain('//api/skills')
  })

  it('writes into the folder Scout auto-discovers', () => {
    expect(buildBootstrapPrompt(opts)).toContain(`${SKILLS_DIR}/<name>/SKILL.md`)
  })

  it('carries the configured MCP name through for substitution', () => {
    const prompt = buildBootstrapPrompt({ ...opts, mcpName: 'my-scout' })
    expect(prompt).toContain('{{mcp_name}}')  // the token Scout must find
    expect(prompt).toContain('with my-scout')  // and what to put there
  })

  it('asks for the automation and MCP config layout, read-only', () => {
    const prompt = buildBootstrapPrompt(opts)
    expect(prompt).toContain('~/.copilot/mcp-config.json')
    expect(prompt).toMatch(/Microsoft Scout/)
    expect(prompt).toMatch(/read only/i)
  })
})
