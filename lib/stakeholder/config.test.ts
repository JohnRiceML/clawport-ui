// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockExistsSync, mockReadFileSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}))

import {
  DEFAULT_STAKEHOLDER_CONFIG,
  loadStakeholderConfig,
  resolveStakeholderConfigPath,
} from '@/lib/stakeholder/config'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveStakeholderConfigPath', () => {
  it('returns null when workspace path is missing', () => {
    expect(resolveStakeholderConfigPath(null)).toBeNull()
  })

  it('places stakeholder config under workspace/clawport', () => {
    expect(resolveStakeholderConfigPath('/tmp/workspace')).toBe(
      '/tmp/workspace/clawport/stakeholder.json',
    )
  })
})

describe('loadStakeholderConfig', () => {
  it('returns defaults when config file is missing', () => {
    mockExistsSync.mockReturnValue(false)
    expect(loadStakeholderConfig('/tmp/workspace')).toEqual(DEFAULT_STAKEHOLDER_CONFIG)
  })

  it('loads valid job overrides', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        defaultVisibility: 'delivery_only',
        jobs: {
          weekly: {
            visible: true,
            title: 'Weekly Brief',
            priority: 'primary',
          },
        },
      }),
    )

    expect(loadStakeholderConfig('/tmp/workspace')).toEqual({
      defaultVisibility: 'delivery_only',
      jobs: {
        weekly: {
          visible: true,
          title: 'Weekly Brief',
          priority: 'primary',
        },
      },
    })
  })

  it('ignores invalid job fields while preserving valid ones', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        jobs: {
          weekly: {
            visible: 'yes',
            title: '  Weekly Brief  ',
            priority: 'primary',
          },
        },
      }),
    )

    expect(loadStakeholderConfig('/tmp/workspace')).toEqual({
      defaultVisibility: 'delivery_only',
      jobs: {
        weekly: {
          title: 'Weekly Brief',
          priority: 'primary',
        },
      },
    })
  })

  it('falls back to defaults on invalid JSON', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation(() => {
      throw new Error('bad json')
    })

    expect(loadStakeholderConfig('/tmp/workspace')).toEqual(DEFAULT_STAKEHOLDER_CONFIG)
  })
})
