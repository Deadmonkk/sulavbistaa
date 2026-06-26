import { Fragment, type ReactNode } from "react";

// Minimal, dependency-free Markdown renderer for the agent report. Renders via
// JSX (no dangerouslySetInnerHTML) so model-generated text can't inject HTML.
// Supports: # ## ### headings, - / * and 1. lists, **bold**, *italic*, ---, and
// paragraphs. Anything else renders as plain text.

interface MarkdownProps {
  text: string;
}

export function Markdown({ text }: MarkdownProps) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{renderInline(it)}</li>);
    blocks.push(
      list.ordered ? (
        <ol key={key++} className="my-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed">{items}</ol>
      ) : (
        <ul key={key++} className="my-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">{items}</ul>
      ),
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); continue; }

    if (/^---+$/.test(line.trim())) { flushList(); blocks.push(<hr key={key++} className="my-5 border-border" />); continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushList();
      const level = h[1].length;
      const content = renderInline(h[2]);
      if (level === 1) blocks.push(<h2 key={key++} className="font-display mt-6 mb-2 text-2xl">{content}</h2>);
      else if (level === 2) blocks.push(<h3 key={key++} className="mt-5 mb-2 text-lg font-semibold">{content}</h3>);
      else blocks.push(<h4 key={key++} className="mt-4 mb-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{content}</h4>);
      continue;
    }

    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ol) { if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; } list.items.push(ol[1]); continue; }
    if (ul) { if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; } list.items.push(ul[1]); continue; }

    flushList();
    blocks.push(<p key={key++} className="my-2 text-sm leading-relaxed text-foreground/90">{renderInline(line)}</p>);
  }
  flushList();

  return <div>{blocks}</div>;
}

// Inline: **bold** and *italic*.
function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>);
    const token = m[0];
    if (token.startsWith("**")) parts.push(<strong key={i++}>{token.slice(2, -2)}</strong>);
    else parts.push(<em key={i++}>{token.slice(1, -1)}</em>);
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);
  return parts;
}
