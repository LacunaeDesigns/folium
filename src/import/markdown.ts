/**
 * Markdown → card blocks, for importing Milanote markdown exports
 * (and any generic markdown) as AtlasNote boards.
 */

interface TiptapNode {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  content?: TiptapNode[]
}

export type ParsedBlock =
  | { kind: 'note'; doc: unknown; estLines: number }
  | { kind: 'todo'; items: { text: string; done: boolean }[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'image'; url: string; caption: string }
  | { kind: 'link'; url: string; title: string }

const RE = {
  heading: /^(#{1,6})\s+(.*)$/,
  task: /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/,
  bullet: /^\s*[-*+]\s+(?!\[[ xX]\]\s)(.*)$/,
  ordered: /^\s*\d+[.)]\s+(.*)$/,
  tableRow: /^\s*\|.*\|\s*$/,
  tableSep: /^\s*\|?\s*:?-{2,}.*$/,
  imageOnly: /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)\s*$/,
  linkOnly: /^\[([^\]]+)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)\s*$/,
  bareUrl: /^https?:\/\/\S+$/,
  quote: /^>\s?(.*)$/,
}

/** Inline markdown (**bold** *italic* `code` ~~strike~~ [text](url)) → TipTap text nodes. */
export function inlineNodes(text: string): TiptapNode[] {
  const out: TiptapNode[] = []
  const re =
    /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(~~([^~]+)~~)|(\[([^\]]+)\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\))/g
  let last = 0
  let m: RegExpExecArray | null
  const push = (t: string, marks?: TiptapNode['marks']) => {
    if (t) out.push({ type: 'text', text: t, ...(marks ? { marks } : {}) })
  }
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index))
    if (m[2]) push(m[2], [{ type: 'bold' }])
    else if (m[4]) push(m[4], [{ type: 'italic' }])
    else if (m[6]) push(m[6], [{ type: 'code' }])
    else if (m[8]) push(m[8], [{ type: 'strike' }])
    else if (m[10]) push(m[10], [{ type: 'link', attrs: { href: m[11] } }])
    last = m.index + m[0].length
  }
  push(text.slice(last))
  return out
}

function paragraph(text: string): TiptapNode {
  const content = inlineNodes(text)
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

export function parseMarkdown(md: string): { title: string; blocks: ParsedBlock[] } {
  const lines = md.split(/\r?\n/)
  const blocks: ParsedBlock[] = []
  let title = ''
  let titleTaken = false

  // current note accumulation
  let noteContent: TiptapNode[] = []
  let noteLines = 0
  let list: { type: 'bulletList' | 'orderedList'; items: TiptapNode[] } | null = null

  const flushList = () => {
    if (list && list.items.length) {
      noteContent.push({ type: list.type, content: list.items })
    }
    list = null
  }

  const flushNote = () => {
    flushList()
    if (noteContent.length) {
      blocks.push({ kind: 'note', doc: { type: 'doc', content: noteContent }, estLines: Math.max(2, noteLines) })
    }
    noteContent = []
    noteLines = 0
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      i++
      continue
    }

    const heading = RE.heading.exec(trimmed)
    if (heading) {
      if (!titleTaken && heading[1] === '#' && blocks.length === 0 && noteContent.length === 0) {
        title = heading[2].trim()
        titleTaken = true
        i++
        continue
      }
      flushNote()
      noteContent.push({
        type: 'heading',
        attrs: { level: heading[1].length === 1 ? 1 : 2 },
        content: inlineNodes(heading[2].trim()),
      })
      noteLines += 1
      i++
      continue
    }

    const task = RE.task.exec(line)
    if (task) {
      flushNote()
      const items: { text: string; done: boolean }[] = []
      while (i < lines.length) {
        const t = RE.task.exec(lines[i])
        if (!t) break
        items.push({ text: t[2].trim(), done: t[1].toLowerCase() === 'x' })
        i++
      }
      blocks.push({ kind: 'todo', items })
      continue
    }

    if (RE.tableRow.test(line)) {
      flushNote()
      const rows: string[][] = []
      while (i < lines.length && RE.tableRow.test(lines[i])) {
        const cells = splitTableRow(lines[i])
        const isSep = cells.every((c) => RE.tableSep.test(c) || /^:?-{2,}:?$/.test(c))
        if (!isSep) rows.push(cells)
        i++
      }
      if (rows.length) blocks.push({ kind: 'table', rows })
      continue
    }

    const image = RE.imageOnly.exec(trimmed)
    if (image) {
      flushNote()
      blocks.push({ kind: 'image', url: image[2], caption: image[1] })
      i++
      continue
    }

    const linkOnly = RE.linkOnly.exec(trimmed)
    if (linkOnly) {
      flushNote()
      blocks.push({ kind: 'link', url: linkOnly[2], title: linkOnly[1] })
      i++
      continue
    }

    if (RE.bareUrl.test(trimmed)) {
      flushNote()
      blocks.push({ kind: 'link', url: trimmed, title: '' })
      i++
      continue
    }

    const bullet = RE.bullet.exec(line)
    if (bullet) {
      if (list?.type !== 'bulletList') {
        flushList()
        list = { type: 'bulletList', items: [] }
      }
      list.items.push({ type: 'listItem', content: [paragraph(bullet[1].trim())] })
      noteLines += 1
      i++
      continue
    }

    const ordered = RE.ordered.exec(line)
    if (ordered) {
      if (list?.type !== 'orderedList') {
        flushList()
        list = { type: 'orderedList', items: [] }
      }
      list.items.push({ type: 'listItem', content: [paragraph(ordered[1].trim())] })
      noteLines += 1
      i++
      continue
    }

    const quote = RE.quote.exec(line)
    if (quote) {
      flushList()
      noteContent.push({ type: 'blockquote', content: [paragraph(quote[1])] })
      noteLines += 1
      i++
      continue
    }

    // plain paragraph line
    flushList()
    noteContent.push(paragraph(trimmed))
    noteLines += Math.ceil(trimmed.length / 40)
    i++
  }

  flushNote()
  return { title, blocks }
}
