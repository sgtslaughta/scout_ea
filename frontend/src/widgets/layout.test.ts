import { describe, it, expect, beforeEach } from 'vitest'
import {
  defaultLayout, loadLayout, saveLayout, reorderWidgets, setWidgetHidden, LAYOUT_KEY,
} from './layout'

const KEYS = ['a', 'b', 'c']

describe('dashboard layout', () => {
  beforeEach(() => localStorage.clear())

  it('defaultLayout shows all keys in registry order', () => {
    expect(defaultLayout(KEYS)).toEqual({ order: ['a', 'b', 'c'], hidden: [] })
  })

  it('loadLayout returns default when nothing stored', () => {
    expect(loadLayout(KEYS)).toEqual(defaultLayout(KEYS))
  })

  it('round-trips through localStorage', () => {
    saveLayout({ order: ['c', 'a', 'b'], hidden: ['b'] })
    expect(loadLayout(KEYS)).toEqual({ order: ['c', 'a', 'b'], hidden: ['b'] })
  })

  it('drops unknown keys and appends new registry keys on load', () => {
    saveLayout({ order: ['zombie', 'b', 'a'], hidden: ['zombie', 'c'] })
    expect(loadLayout(KEYS)).toEqual({ order: ['b', 'a', 'c'], hidden: ['c'] })
  })

  it('ignores corrupt stored JSON', () => {
    localStorage.setItem(LAYOUT_KEY, '{not json')
    expect(loadLayout(KEYS)).toEqual(defaultLayout(KEYS))
  })

  it('reorderWidgets moves an item forward onto a later item', () => {
    const l = defaultLayout(KEYS)
    expect(reorderWidgets(l, 'a', 'c').order).toEqual(['b', 'c', 'a'])
  })

  it('reorderWidgets moves an item backward onto an earlier item', () => {
    const l = defaultLayout(KEYS)
    expect(reorderWidgets(l, 'c', 'a').order).toEqual(['c', 'a', 'b'])
  })

  it('reorderWidgets is a no-op when activeKey equals overKey', () => {
    const l = defaultLayout(KEYS)
    expect(reorderWidgets(l, 'b', 'b').order).toEqual(['a', 'b', 'c'])
  })

  it('reorderWidgets is a no-op when activeKey is unknown', () => {
    const l = defaultLayout(KEYS)
    expect(reorderWidgets(l, 'zombie', 'a').order).toEqual(['a', 'b', 'c'])
  })

  it('reorderWidgets is a no-op when overKey is unknown', () => {
    const l = defaultLayout(KEYS)
    expect(reorderWidgets(l, 'a', 'zombie').order).toEqual(['a', 'b', 'c'])
  })

  it('reorderWidgets does not throw on single-item or empty order arrays', () => {
    expect(reorderWidgets(defaultLayout(['a']), 'a', 'a').order).toEqual(['a'])
    expect(reorderWidgets(defaultLayout([]), 'a', 'b').order).toEqual([])
  })

  it('reorderWidgets does not mutate the input layout', () => {
    const l = defaultLayout(KEYS)
    const snapshot = { ...l, order: [...l.order] }
    reorderWidgets(l, 'a', 'c')
    expect(l).toEqual(snapshot)
  })

  it('setWidgetHidden adds/removes without duplicates', () => {
    const l = defaultLayout(KEYS)
    const h = setWidgetHidden(setWidgetHidden(l, 'b', true), 'b', true)
    expect(h.hidden).toEqual(['b'])
    expect(setWidgetHidden(h, 'b', false).hidden).toEqual([])
  })
})
