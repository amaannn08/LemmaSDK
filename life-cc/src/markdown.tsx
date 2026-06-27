import type { ReactNode } from 'react'

// Minimal markdown rendering for agent output: headers, bold, bullet lists,
// horizontal rules, paragraphs. The briefing/extraction agents are instructed
// to keep output to plain prose + bullets, but models don't always comply —
// this is a defensive net, not a general-purpose renderer, so still no new
// dependency for the rest of CommonMark (no tables, no nested lists, etc).
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-zinc-100">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  )
}

export function Markdown({ text }: { text: string }) {
  const blocks = text
    .trim()
    .split(/\n\s*\n/)
    // Drop blocks that are just a horizontal rule (---, ***, ___).
    .filter((block) => !/^[\s*_-]+$/.test(block.trim()))

  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter(Boolean)
        const headerMatch = lines.length === 1 ? /^(#{1,6})\s+(.*)/.exec(lines[0].trim()) : null
        if (headerMatch) {
          return (
            <p key={i} className="font-semibold text-zinc-100">
              {renderInline(headerMatch[2])}
            </p>
          )
        }
        const isList = lines.every((l) => /^[-*]\s/.test(l.trim()))
        if (isList) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-4">
              {lines.map((line, j) => (
                <li key={j}>{renderInline(line.trim().replace(/^[-*]\s/, ''))}</li>
              ))}
            </ul>
          )
        }
        return <p key={i}>{renderInline(lines.join(' '))}</p>
      })}
    </div>
  )
}
