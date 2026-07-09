import { describe, it, expect, beforeEach } from 'vitest'
import {
  defaultLayout, loadLayout, saveLayout, moveWidget, setWidgetHidden, LAYOUT_KEY,
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

  it('moveWidget swaps within bounds and clamps at edges', () => {
    const l = defaultLayout(KEYS)
    expect(moveWidget(l, 'b', -1).order).toEqual(['b', 'a', 'c'])
    expect(moveWidget(l, 'a', -1).order).toEqual(['a', 'b', 'c'])
    expect(moveWidget(l, 'c', 1).order).toEqual(['a', 'b', 'c'])
  })

  it('setWidgetHidden adds/removes without duplicates', () => {
    const l = defaultLayout(KEYS)
    const h = setWidgetHidden(setWidgetHidden(l, 'b', true), 'b', true)
    expect(h.hidden).toEqual(['b'])
    expect(setWidgetHidden(h, 'b', false).hidden).toEqual([])
  })
})
