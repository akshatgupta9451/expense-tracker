import { useEffect, useRef, useState } from 'react'
import ChatMessage from '@/components/assistant/ChatMessage'
import InsightsPanel from '@/components/assistant/InsightsPanel'
import PageHeader from '@/components/common/PageHeader'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { assistantService } from '@/services/assistantService'

const SUGGESTED_QUESTIONS = [
  'What are my spending patterns?',
  'How can I save more money?',
  'Predict my spending for next month',
  'Am I on track with my budgets?',
]

export default function AssistantPage() {
  useDocumentTitle('AI Assistant')
  const insights = useAsync(() => assistantService.insights(), [])

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function send(text) {
    const message = text.trim()
    if (!message || streaming) return

    const history = messages.filter((m) => m.content)
    setMessages([
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: '' },
    ])
    setInput('')
    setError(null)
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller
    try {
      await assistantService.chat({
        message,
        history,
        signal: controller.signal,
        onDelta: (delta) =>
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            return [...prev.slice(0, -1), { ...last, content: last.content + delta }]
          }),
      })
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError({ message: err.message, question: message })
        // Drop the unanswered question (and any partial answer) so a retry starts clean.
        setMessages(history)
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Ask about your spending patterns, ways to save, and what to expect next month."
        actions={
          messages.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                abortRef.current?.abort()
                setMessages([])
                setError(null)
              }}
            >
              New chat
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="flex h-[calc(100vh-14rem)] min-h-[28rem] flex-col rounded-xl bg-white shadow-sm ring-1 ring-gray-200 lg:col-span-2">
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto p-5"
            aria-live="polite"
            aria-busy={streaming}
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 rounded-full bg-brand-50 p-3 text-brand-600">
                  <Icon name="sparkles" className="h-6 w-6" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">
                  Your personal finance assistant
                </h2>
                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  Answers are based on your last six months of transactions and budgets.
                </p>
                <div className="mt-6 flex max-w-lg flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="rounded-full bg-white px-3.5 py-1.5 text-sm text-gray-700 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-900"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <ChatMessage
                  key={i}
                  role={m.role}
                  content={m.content}
                  streaming={streaming && i === messages.length - 1}
                />
              ))
            )}
          </div>

          {error && (
            <Alert className="mx-5 mb-3" title="The assistant couldn't answer">
              {error.message}{' '}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => send(error.question)}
              >
                Try again
              </button>
            </Alert>
          )}

          <form
            className="flex items-end gap-2 border-t border-gray-100 p-4"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <label htmlFor="assistant-input" className="sr-only">
              Ask the assistant
            </label>
            <textarea
              id="assistant-input"
              rows={1}
              value={input}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your spending…"
              className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border-0 px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-brand-500"
            />
            {streaming ? (
              <Button variant="secondary" onClick={() => abortRef.current?.abort()}>
                <Icon name="stop" className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim()} aria-label="Send">
                <Icon name="send" className="h-4 w-4" />
              </Button>
            )}
          </form>
        </section>

        <aside>
          {insights.error ? (
            <Alert>{insights.error}</Alert>
          ) : (
            <InsightsPanel insights={insights.data} loading={insights.loading} />
          )}
        </aside>
      </div>
    </>
  )
}
