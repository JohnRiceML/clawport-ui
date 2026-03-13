import { describe, expect, it } from 'vitest'

import { shouldHideClientNavPath } from './branding'

describe('shouldHideClientNavPath', () => {
  it('hides client-only paths on the production host', () => {
    expect(shouldHideClientNavPath('/crons', true)).toBe(true)
    expect(shouldHideClientNavPath('/memory', true)).toBe(true)
    expect(shouldHideClientNavPath('/docs', true)).toBe(true)
  })

  it('keeps client-only paths visible off the production host', () => {
    expect(shouldHideClientNavPath('/crons', false)).toBe(false)
    expect(shouldHideClientNavPath('/crons', null)).toBe(false)
  })

  it('never hides non-client-only paths', () => {
    expect(shouldHideClientNavPath('/activity', true)).toBe(false)
    expect(shouldHideClientNavPath('/settings', false)).toBe(false)
  })
})
