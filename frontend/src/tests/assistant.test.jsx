import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FormattedText } from '@/components/assistant/ChatMessage'
import AssistantPage from '@/pages/AssistantPage'
import { refreshAccessToken } from '@/services/apiClient'
import { assistantService } from '@/services/assistantService'
import { tokenStore } from '@/services/tokenStore'

vi.mock('@/services/apiClient', () => ({
  default: { get: vi.fn() },
  refreshAccessToken: vi.fn(),
}))

/** A fetch Response whose body arrives in the given string chunks. */
function streamResponse(chunks, status = 200) {
  const encoder = new TextEncoder()
  return {
    ok: status < 400,
    status,
    json: async () => JSON.parse(chunks.join('')),
    body: {
      getReader() {
        let i = 0
        return {
          read: async () =>
            i < chunks.length
              ? { done: false, value: encoder.encode(chunks[i++]) }
              : { done: true, value: undefined },
        }
      },
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  tokenStore.clear()
})

// ---------- service ----------

test('chat streams NDJSON deltas, including lines split across chunks', async () => {
  tokenStore.set('tok')
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      streamResponse([
        '{"type":"delta","text":"You spend "}\n{"type":"del',
        'ta","text":"most on food."}\n',
        '{"type":"done"}\n',
      ]),
    )
  const deltas = []
  await assistantService.chat({ message: 'hi', history: [], onDelta: (t) => deltas.push(t) })

  expect(deltas).toEqual(['You spend ', 'most on food.'])
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/assistant/chat')
  expect(init.headers.Authorization).toBe('Bearer tok')
  expect(JSON.parse(init.body)).toEqual({ message: 'hi', history: [] })
})

test('chat refreshes the access token once on 401', async () => {
  refreshAccessToken.mockImplementation(async () => tokenStore.set('fresh'))
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(streamResponse(['{}'], 401))
    .mockResolvedValueOnce(streamResponse(['{"type":"done"}\n']))
  await assistantService.chat({ message: 'hi', history: [], onDelta: () => {} })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh')
})

test('chat surfaces HTTP and in-stream errors', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    streamResponse(['{"error":{"message":"Set ANTHROPIC_API_KEY"}}'], 503),
  )
  await expect(assistantService.chat({ message: 'hi', history: [] })).rejects.toThrow(
    'Set ANTHROPIC_API_KEY',
  )

  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    streamResponse(['{"type":"error","message":"busy"}\n']),
  )
  await expect(
    assistantService.chat({ message: 'hi', history: [], onDelta: () => {} }),
  ).rejects.toThrow('busy')
})

// ---------- formatting ----------

test('formats bullets and bold text without raw markdown', () => {
  const { container } = render(
    <FormattedText text={'Your top costs:\n- **Rent** $1,500\n- Food $440\n\nKeep going.'} />,
  )
  expect(container.querySelectorAll('li')).toHaveLength(2)
  expect(screen.getByText('Rent').tagName).toBe('STRONG')
  expect(container.textContent).not.toContain('**')
})

// ---------- page ----------

const INSIGHTS = {
  has_data: true,
  currency: 'USD',
  months: [],
  categories: [],
  month_to_date: '820.00',
  projected_this_month: '1100.00',
  predicted_next_month: '1050.00',
  budgets: [
    { category: 'Food & Dining', limit: '200', spent: '180', projected: '260', at_risk: true },
  ],
  patterns: ['Food & Dining is your biggest expense.'],
  suggestions: ['Cutting Food & Dining by 20% would save about USD 50.00 a month.'],
}

test('page shows insights and streams an answer to a suggested question', async () => {
  vi.spyOn(assistantService, 'insights').mockResolvedValue(INSIGHTS)
  const chat = vi.spyOn(assistantService, 'chat').mockImplementation(async ({ onDelta }) => {
    onDelta('Mostly ')
    onDelta('**food**.')
  })
  render(<AssistantPage />)

  expect(await screen.findByText('Food & Dining is your biggest expense.')).toBeInTheDocument()
  expect(screen.getByText('$1,100.00')).toBeInTheDocument()
  expect(screen.getByText('1 budget is on track to be exceeded')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'What are my spending patterns?' }))
  expect(await screen.findByText('food')).toBeInTheDocument()
  expect(screen.getByText('What are my spending patterns?')).toBeInTheDocument()
  expect(chat.mock.calls[0][0]).toMatchObject({
    message: 'What are my spending patterns?',
    history: [],
  })

  // The follow-up carries the finished first exchange as history.
  fireEvent.change(screen.getByLabelText('Ask the assistant'), { target: { value: 'And rent?' } })
  fireEvent.keyDown(screen.getByLabelText('Ask the assistant'), { key: 'Enter' })
  await waitFor(() => expect(chat).toHaveBeenCalledTimes(2))
  expect(chat.mock.calls[1][0].history).toEqual([
    { role: 'user', content: 'What are my spending patterns?' },
    { role: 'assistant', content: 'Mostly **food**.' },
  ])
})

test('failed answer shows the error and can be retried', async () => {
  vi.spyOn(assistantService, 'insights').mockResolvedValue(INSIGHTS)
  const chat = vi
    .spyOn(assistantService, 'chat')
    .mockRejectedValueOnce(new Error('The assistant is busy right now.'))
    .mockImplementationOnce(async ({ onDelta }) => onDelta('Here you go.'))
  render(<AssistantPage />)

  fireEvent.click(screen.getByRole('button', { name: 'How can I save more money?' }))
  expect(await screen.findByText('The assistant is busy right now.')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Here you go.')).toBeInTheDocument()
  expect(chat).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('The assistant is busy right now.')).not.toBeInTheDocument()
})
