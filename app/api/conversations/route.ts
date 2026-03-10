import { listConversations } from '@/lib/conversation-store'
import { apiErrorResponse } from '@/lib/api-error'

export async function GET() {
  try {
    const conversations = listConversations()
    return Response.json(conversations)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to list conversations')
  }
}
