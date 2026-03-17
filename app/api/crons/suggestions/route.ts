export const runtime = 'nodejs'

import { getCrons } from '@/lib/crons'
import { getAgents } from '@/lib/agents'
import { getActiveComposioApps } from '@/lib/composio'
import { getIntegrationsSummary } from '@/lib/integrations'
import { getGoogleWorkspaceConfig } from '@/lib/integrations'
import { buildCronSuggestionsPrompt } from '@/lib/pipeline-utils'
import { gatewayBaseUrl } from '@/lib/env'
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: gatewayBaseUrl(),
  apiKey: process.env.OPENCLAW_GATEWAY_TOKEN,
})

export async function GET() {
  try {
    const [crons, agents, composioApps, integrationsSummary, gwsConfig] = await Promise.all([
      getCrons(),
      getAgents(),
      getActiveComposioApps(),
      Promise.resolve(getIntegrationsSummary()),
      Promise.resolve(getGoogleWorkspaceConfig()),
    ])

    // Build combined list of available services
    const services = [...composioApps]

    // Add GWS service account integrations (non-Composio)
    if (gwsConfig?.driveEnabled) {
      if (!services.includes('googledrive')) services.push('googledrive')
      if (!services.includes('googledocs')) services.push('googledocs')
    }

    // Add enabled tools from openclaw.json
    for (const tool of integrationsSummary.tools) {
      if (tool.enabled !== false && !services.includes(tool.id)) {
        services.push(tool.id)
      }
    }

    if (services.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: null, reason: 'No connected services found' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Find root agent for the prompt
    const rootAgent = agents.find(a => !a.reportsTo) || agents[0]
    if (!rootAgent) {
      return new Response(
        JSON.stringify({ suggestions: null, reason: 'No agents found' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const prompt = buildCronSuggestionsPrompt(crons, agents, services)

    const stream = await openai.chat.completions.create({
      model: rootAgent.model || 'claude-sonnet-4-6',
      stream: true,
      messages: [
        { role: 'user', content: prompt },
      ],
    })

    const streamBody = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              )
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          console.error('Cron suggestions stream error:', err instanceof Error ? err.message : err)
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(streamBody, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('Cron suggestions error:', err instanceof Error ? err.message : err)
    return new Response(
      JSON.stringify({ error: 'Failed to generate suggestions' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
