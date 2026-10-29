import api, { refreshAccessToken } from './apiClient'
import { tokenStore } from './tokenStore'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

function postChat(body, signal) {
  const token = tokenStore.get()
  return fetch(`${baseURL}/assistant/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
    signal,
  })
}

async function errorMessage(response) {
  try {
    const data = await response.json()
    return data?.error?.message
  } catch {
    return null
  }
}

export const assistantService = {
  /** Spending patterns, saving suggestions and predictions (computed server-side, no LLM). */
  insights: () => api.get('/assistant/insights').then((r) => r.data),

  /**
   * Ask the assistant. Streams the answer: `onDelta(text)` is called for each chunk.
   * Uses fetch rather than axios so the NDJSON response can be read as it arrives.
   * `history` is [{ role: 'user' | 'assistant', content }] of earlier turns.
   */
  async chat({ message, history, onDelta, signal }) {
    const body = { message, history }
    let response = await postChat(body, signal)
    if (response.status === 401) {
      await refreshAccessToken()
      response = await postChat(body, signal)
    }
    if (!response.ok) {
      throw new Error(
        (await errorMessage(response)) || 'The assistant is unavailable. Please try again.',
      )
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line)
        if (event.type === 'delta') onDelta(event.text)
        else if (event.type === 'error') throw new Error(event.message)
      }
    }
  },
}
