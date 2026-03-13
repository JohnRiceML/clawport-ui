import { describe, expect, it } from 'vitest'

import { CLIENT_HUB_PATH, shouldHideClientNavPath, shouldShowClientHub } from './branding'

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

describe('shouldShowClientHub', () => {
  it('shows the client hub on client-facing hosts', () => {
    expect(shouldShowClientHub(true)).toBe(true)
  })

  it('hides the client hub when the host is not client-facing', () => {
    expect(shouldShowClientHub(false)).toBe(false)
    expect(shouldShowClientHub(null)).toBe(false)
  })

  it('exposes a stable client hub path', () => {
    expect(CLIENT_HUB_PATH).toBe('/client')
  })
})
