export const APP_NAME = 'Monarck'
export const CLIENT_HUB_PATH = '/client'

export const CLIENT_HIDDEN_NAV_PATHS = ['/crons', '/memory', '/docs'] as const

export function isMonarckProductionHost(hostname: string): boolean {
  return hostname === 'monarck.ai' || hostname.endsWith('.monarck.ai')
}

export function shouldShowClientHub(isClientFacingHost: boolean | null): boolean {
  return isClientFacingHost === true
}

export function shouldHideClientNavPath(
  path: string,
  isClientFacingHost: boolean | null,
): boolean {
  if (isClientFacingHost !== true) return false
  return CLIENT_HIDDEN_NAV_PATHS.includes(
    path as typeof CLIENT_HIDDEN_NAV_PATHS[number],
  )
}
