import Icon from '@/components/ui/Icon'
import { cn } from '@/utils/cn'

/** "Spent **$420** on food" -> ["Spent ", <strong>$420</strong>, " on food"] */
function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold text-gray-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  )
}

/**
 * The assistant answers in short paragraphs and "- " bullets with **bold** numbers; render
 * just that subset instead of pulling in a markdown library.
 */
export function FormattedText({ text }) {
  const blocks = []
  for (const line of text.split('\n')) {
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    const last = blocks[blocks.length - 1]
    if (bullet) {
      if (last?.type === 'list') last.items.push(bullet[1])
      else blocks.push({ type: 'list', items: [bullet[1]] })
    } else if (line.trim()) {
      blocks.push({ type: 'p', text: line.replace(/^#+\s*/, '') })
    }
  }
  return (
    <div className="space-y-2">
      {blocks.map((block, i) =>
        block.type === 'list' ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{renderInline(block.text)}</p>
        ),
      )}
    </div>
  )
}

export default function ChatMessage({ role, content, streaming = false }) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex gap-3', isUser && 'justify-end')}>
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Icon name="sparkles" className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'whitespace-pre-wrap bg-brand-600 text-white'
            : 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200',
        )}
      >
        {isUser ? (
          content
        ) : content ? (
          <FormattedText text={content} />
        ) : (
          streaming && (
            <span className="flex gap-1 py-1.5" aria-label="Assistant is typing">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          )
        )}
      </div>
    </div>
  )
}
