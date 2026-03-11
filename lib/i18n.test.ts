import { describe, expect, it } from 'vitest'
import {
  detectBrowserLocale,
  getCopy,
  isLocalePreference,
  localizeAgentDescription,
  localizeMemoryHealthCheck,
  resolveLocale,
} from './i18n'

describe('detectBrowserLocale', () => {
  it('returns zh-CN when browser languages include Chinese', () => {
    expect(detectBrowserLocale({ language: 'en-US', languages: ['zh-CN', 'en-US'] })).toBe('zh-CN')
  })

  it('falls back to en for non-Chinese browser locales', () => {
    expect(detectBrowserLocale({ language: 'en-US', languages: ['en-US'] })).toBe('en')
  })
})

describe('resolveLocale', () => {
  it('resolves explicit locales without browser detection', () => {
    expect(resolveLocale('en')).toBe('en')
    expect(resolveLocale('zh-CN')).toBe('zh-CN')
  })

  it('resolves system locale from the browser', () => {
    expect(resolveLocale('system', { language: 'zh-TW' })).toBe('zh-CN')
  })
})

describe('isLocalePreference', () => {
  it('accepts supported locale values', () => {
    expect(isLocalePreference('system')).toBe(true)
    expect(isLocalePreference('en')).toBe(true)
    expect(isLocalePreference('zh-CN')).toBe(true)
  })

  it('rejects unsupported values', () => {
    expect(isLocalePreference('fr')).toBe(false)
    expect(isLocalePreference(null)).toBe(false)
  })
})

describe('getCopy', () => {
  it('returns localized navigation labels', () => {
    expect(getCopy('zh-CN').nav.messages).toBe('消息')
    expect(getCopy('en').nav.messages).toBe('Messages')
  })

  it('returns localized settings and chat copy', () => {
    expect(getCopy('zh-CN').settings.pageTitle).toBe('设置')
    expect(getCopy('zh-CN').chat.messagePlaceholder('Jarvis')).toBe('给 Jarvis 发消息...')
    expect(getCopy('en').chat.messagePlaceholder('Jarvis')).toBe('Message Jarvis...')
  })

  it('returns localized cron copy', () => {
    expect(getCopy('zh-CN').crons.title).toBe('定时任务监控')
    expect(getCopy('en').crons.filters.error).toBe('Errors')
  })

  it('returns localized costs copy', () => {
    expect(getCopy('zh-CN').costs.title).toBe('成本与优化')
    expect(getCopy('zh-CN').costs.jobsTable.estCost).toBe('预估成本')
    expect(getCopy('en').costs.agentOptimizer.send).toBe('Send')
  })
})

describe('localizeAgentDescription', () => {
  it('uses stable agent ids for bundled agent copy', () => {
    expect(
      localizeAgentDescription(
        'jarvis',
        'Top-level orchestrator. Manages the team, holds memory, delivers briefings.',
        'zh-CN',
      ),
    ).toBe('顶层编排者。负责统筹团队、持有长期记忆，并输出简报。')
  })

  it('falls back to shared phrase translations for non-bundled agents', () => {
    expect(localizeAgentDescription('custom-root', 'Top-level orchestrator.', 'zh-CN')).toBe('顶层编排者。')
  })

  it('leaves unknown descriptions untouched', () => {
    expect(localizeAgentDescription('custom', 'Custom agent description.', 'zh-CN')).toBe('Custom agent description.')
    expect(localizeAgentDescription('jarvis', 'Anything', 'en')).toBe('Anything')
  })
})

describe('localizeMemoryHealthCheck', () => {
  it('keeps technical titles while translating explanation text', () => {
    expect(
      localizeMemoryHealthCheck(
        {
          id: 'unindexed-vector',
          title: 'Vector search enabled but not indexed',
          description: 'Memory search is enabled in config but no index exists. Agents cannot use semantic search until the index is built.',
        },
        'zh-CN',
      ),
    ).toEqual({
      title: 'Vector search enabled but not indexed',
      description: '配置里已经开启 memory search，但当前还没有索引。完成建索引之前，智能体无法使用语义检索。',
    })
  })

  it('localizes dynamic stale-index descriptions', () => {
    expect(
      localizeMemoryHealthCheck(
        {
          id: 'stale-index',
          title: 'Search index is stale',
          description: '3 files were modified after the last index (12h ago). Agents may miss recent edits.',
        },
        'zh-CN',
      ),
    ).toEqual({
      title: 'Search index is stale',
      description: '上次建索引后已有 3 个文件发生变更，距今约 12 小时。智能体可能看不到这些最新修改。',
    })
  })
})
