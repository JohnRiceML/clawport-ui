import OpenAI from 'openai'
import { gatewayBaseUrl, gatewayToken } from './env'

/**
 * Lazy-initialized OpenAI client for the OpenClaw gateway.
 *
 * IMPORTANT: Call this inside route handlers, not at module top level.
 * This prevents build errors when environment variables aren't set during build.
 */
let _openai: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      baseURL: gatewayBaseUrl(),
      apiKey: gatewayToken(),
    })
  }
  return _openai
}