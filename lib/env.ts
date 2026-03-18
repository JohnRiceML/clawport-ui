/**
 * Safely retrieve a required environment variable at runtime.
 * Call inside functions (not at module top level) so imports don't crash during build/test.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `See .env.example for configuration.`
    )
  }
  return value
}

/** OpenClaw gateway port — reads OPENCLAW_GATEWAY_PORT, defaults to 18789. */
export function gatewayPort(): number {
  return parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10)
}

/** OpenClaw gateway base URL for the OpenAI-compatible API (e.g. http://localhost:18789/v1). */
export function gatewayBaseUrl(): string {
  return `http://localhost:${gatewayPort()}/v1`
}

/** OpenClaw gateway auth token. */
export function gatewayToken(): string {
  return process.env.OPENCLAW_GATEWAY_TOKEN || ''
}
