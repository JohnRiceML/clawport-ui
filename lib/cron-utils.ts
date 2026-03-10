/**
 * Cron schedule parsing and human-readable description utilities.
 * No external dependencies — covers the ~10 patterns observed in production.
 */

const DAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12
  const ampm = hour < 12 ? 'AM' : 'PM'
  const m = minute === 0 ? '' : `:${String(minute).padStart(2, '0')}`
  return `${h}${m} ${ampm}`
}

function formatTimeWithMinute(hour: number, minute: number): string {
  const h = hour % 12 || 12
  const ampm = hour < 12 ? 'AM' : 'PM'
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`
}

/**
 * Extract a cron expression string and optional timezone from the raw schedule
 * value returned by OpenClaw CLI. Handles:
 * - string: "0 8 * * *"
 * - object: { kind: "cron", expr: "0 8 * * *", tz: "America/Chicago" }
 * - object: { expression: "0 8 * * *", timezone: "America/Chicago" }
 * - object: { cron: "0 8 * * *" }
 * - object: { value: "0 8 * * *" }
 * - null/undefined/missing
 */
export function parseSchedule(raw: unknown): { expression: string; timezone: string | null } {
  if (raw == null) return { expression: '', timezone: null }
  if (typeof raw === 'string') return { expression: raw, timezone: null }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    const expression = String(obj.expr ?? obj.expression ?? obj.cron ?? obj.value ?? '')
    const tz = obj.tz ?? obj.timezone
    const timezone = typeof tz === 'string' ? tz : null
    return { expression, timezone }
  }
  return { expression: String(raw), timezone: null }
}

/**
 * Format a duration in milliseconds to a human-readable string.
 * e.g. 147116 → "2m 27s", 45000 → "45s", 3600000 → "1h 0m"
 */
export function formatDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return '—'
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hrs}h ${remMins}m`
}

/**
 * Parse a 5-field cron expression into schedule slots for weekly grid display.
 * Returns an array of { hour, minute, days } where days is 0=Sun..6=Sat.
 * Returns null for unparseable expressions.
 */
export function parseScheduleSlots(expression: string): { hour: number; minute: number; days: number[] } | null {
  if (!expression || !expression.trim()) return null
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const [min, hour, dom, , dow] = parts
  const minNum = parseInt(min, 10)
  const hourNum = parseInt(hour, 10)
  if (isNaN(minNum) || isNaN(hourNum)) return null

  let days: number[]

  if (dow === '*') {
    // Every day (or dom-based — treat as daily for weekly view)
    days = [0, 1, 2, 3, 4, 5, 6]
  } else if (dow === '1-5') {
    days = [1, 2, 3, 4, 5]
  } else if (dow === '0-6' || dow === '0,1,2,3,4,5,6') {
    days = [0, 1, 2, 3, 4, 5, 6]
  } else if (dow.includes(',')) {
    days = dow.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 6)
    if (days.length === 0) return null
  } else {
    const dowNum = parseInt(dow, 10)
    if (isNaN(dowNum) || dowNum < 0 || dowNum > 6) return null
    days = [dowNum]
  }

  return { hour: hourNum, minute: minNum, days }
}

/**
 * Human-readable relative time string.
 * Handles null, empty string, invalid dates, and future dates.
 */
export function timeAgo(dateStr: string | null, locale: 'en' | 'zh-CN' = 'en'): string {
  if (!dateStr) return locale === 'zh-CN' ? '从未' : "never"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "\u2014"
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (diff < 0) {
    const absDiff = Math.abs(diff)
    const m = Math.floor(absDiff / 60000)
    const h = Math.floor(absDiff / 3600000)
    const dy = Math.floor(absDiff / 86400000)
    if (locale === 'zh-CN') {
      if (m < 60) return `${m} 分钟后`
      if (h < 24) return `${h} 小时后`
      return `${dy} 天后`
    }
    if (m < 60) return `in ${m}m`
    if (h < 24) return `in ${h}h`
    return `in ${dy}d`
  }
  if (locale === 'zh-CN') {
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins} 分钟前`
    if (hrs < 24) return `${hrs} 小时前`
    return `${days} 天前`
  }
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  return `${days}d ago`
}

/**
 * Human-readable label for the next scheduled run.
 * Returns "not scheduled", "overdue", or a relative time string.
 */
export function nextRunLabel(dateStr: string | null, locale: 'en' | 'zh-CN' = 'en'): string {
  if (!dateStr) return locale === 'zh-CN' ? '未计划' : 'not scheduled'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "\u2014"
  const diff = d.getTime() - Date.now()
  if (diff < 0) return locale === 'zh-CN' ? '已逾期' : 'overdue'
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (locale === 'zh-CN') {
    if (mins < 60) return `${mins} 分钟后`
    if (hrs < 24) return `${hrs} 小时后`
    return `${days} 天后`
  }
  if (mins < 60) return `in ${mins}m`
  if (hrs < 24) return `in ${hrs}h`
  return `in ${days}d`
}

/**
 * Convert a 5-field cron expression to a human-readable description.
 * Falls back to the raw expression for anything unparseable.
 */
export function describeCron(expression: string): string {
  if (!expression || !expression.trim()) return ''

  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return expression

  const [min, hour, dom, , dow] = parts

  // Every minute: * * * * *
  if (min === '*' && hour === '*' && dom === '*' && dow === '*') {
    return 'Every minute'
  }

  // Every hour: 0 * * * *
  if (min !== '*' && hour === '*' && dom === '*' && dow === '*') {
    return 'Every hour'
  }

  const hourNum = parseInt(hour, 10)
  const minNum = parseInt(min, 10)
  if (isNaN(hourNum) || isNaN(minNum)) return expression

  const time = minNum === 0 ? formatTime(hourNum, minNum) : formatTimeWithMinute(hourNum, minNum)

  // Every N days: 0 12 */2 * *
  if (dom.startsWith('*/') && dow === '*') {
    const interval = parseInt(dom.slice(2), 10)
    if (!isNaN(interval)) {
      return `Every ${interval} days at ${time}`
    }
  }

  // Monthly: 0 8 1 * *
  if (dom !== '*' && dow === '*') {
    const dayNum = parseInt(dom, 10)
    if (!isNaN(dayNum)) {
      const suffix = dayNum === 1 ? 'st' : dayNum === 2 ? 'nd' : dayNum === 3 ? 'rd' : 'th'
      return `Monthly on the ${dayNum}${suffix} at ${time}`
    }
  }

  // Weekdays: 0 10 * * 1-5
  if (dom === '*' && dow === '1-5') {
    return `Weekdays at ${time}`
  }

  // Specific day of week: 0 6 * * 1
  if (dom === '*') {
    const dowNum = parseInt(dow, 10)
    if (!isNaN(dowNum) && dowNum >= 0 && dowNum <= 6) {
      return `${DAY_NAMES[dowNum]} at ${time}`
    }
  }

  // Daily: 0 8 * * *
  if (dom === '*' && dow === '*') {
    return `Daily at ${time}`
  }

  return expression
}
