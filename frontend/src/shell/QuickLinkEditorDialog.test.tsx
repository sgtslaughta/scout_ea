import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickLinkEditorDialog } from './QuickLinkEditorDialog'

function setup(links: { name: string; url: string }[] = []) {
  const onAdd = vi.fn().mockResolvedValue(undefined)
  const onEdit = vi.fn().mockResolvedValue(undefined)
  const onRemove = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(
    <QuickLinkEditorDialog
      open links={links} onClose={onClose} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
    />,
  )
  return { onAdd, onEdit, onRemove, onClose }
}

describe('QuickLinkEditorDialog', () => {
  it('invites the user to add their first link when empty', () => {
    setup([])
    expect(screen.getByText(/add a link to get started/i)).toBeInTheDocument()
  })

  it('adds a link with a valid url', async () => {
    const { onAdd } = setup([])
    await userEvent.type(screen.getByLabelText(/name/i), 'Docs')
    await userEvent.type(screen.getByLabelText(/^link$/i), 'https://example.com')
    await userEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(onAdd).toHaveBeenCalledWith({ name: 'Docs', url: 'https://example.com' })
  })

  it('shows a validation error and blocks save for an invalid url', async () => {
    const { onAdd } = setup([])
    await userEvent.type(screen.getByLabelText(/name/i), 'Docs')
    await userEvent.type(screen.getByLabelText(/^link$/i), 'not a url')
    await userEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByText(/doesn't look like a web address/i)).toBeInTheDocument()
  })

  it('assumes https:// when the address has no scheme', async () => {
    const { onAdd } = setup([])
    await userEvent.type(screen.getByLabelText(/name/i), 'MSX')
    await userEvent.type(screen.getByLabelText(/^link$/i), 'msx.microsoft.com')
    await userEvent.click(screen.getByRole('button', { name: /add link/i }))
    expect(onAdd).toHaveBeenCalledWith({ name: 'MSX', url: 'https://msx.microsoft.com' })
  })

  it('accepts an http:// address such as a local dev server', async () => {
    const { onAdd } = setup([])
    await userEvent.type(screen.getByLabelText(/name/i), 'Local dev')
    await userEvent.type(screen.getByLabelText(/^link$/i), 'http://localhost:5174')
    await userEvent.click(screen.getByRole('button', { name: /add link/i }))
    expect(onAdd).toHaveBeenCalledWith({ name: 'Local dev', url: 'http://localhost:5174' })
  })

  it('rejects a javascript: address', async () => {
    const { onAdd } = setup([])
    await userEvent.type(screen.getByLabelText(/name/i), 'Bad')
    await userEvent.type(screen.getByLabelText(/^link$/i), 'javascript:alert(1)')
    await userEvent.click(screen.getByRole('button', { name: /add link/i }))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('edits an existing link', async () => {
    const { onEdit } = setup([{ name: 'Docs', url: 'https://example.com' }])
    await userEvent.click(screen.getByRole('button', { name: /edit docs/i }))
    const nameField = screen.getByLabelText(/name/i)
    await userEvent.clear(nameField)
    await userEvent.type(nameField, 'Docs2')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onEdit).toHaveBeenCalledWith('Docs', { name: 'Docs2', url: 'https://example.com' })
  })

  it('removes an existing link', async () => {
    const { onRemove } = setup([{ name: 'Docs', url: 'https://example.com' }])
    await userEvent.click(screen.getByRole('button', { name: /remove docs/i }))
    expect(onRemove).toHaveBeenCalledWith('Docs')
  })
})
