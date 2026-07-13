import { Card, DocState } from '../model/types'
import { columnCards } from '../store/selectors'

interface TiptapNode {
  type?: string
  text?: string
  attrs?: { level?: number; checked?: boolean }
  marks?: { type: string; attrs?: { href?: string } }[]
  content?: TiptapNode[]
}

function inline(node: TiptapNode): string {
  if (node.type === 'text') {
    let t = node.text ?? ''
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') t = `**${t}**`
      else if (mark.type === 'italic') t = `*${t}*`
      else if (mark.type === 'strike') t = `~~${t}~~`
      else if (mark.type === 'code') t = '`' + t + '`'
      else if (mark.type === 'highlight') t = `==${t}==`
      else if (mark.type === 'link' && mark.attrs?.href) t = `[${t}](${mark.attrs.href})`
    }
    return t
  }
  return (node.content ?? []).map(inline).join('')
}

export function tiptapToMarkdown(doc: unknown, indent = ''): string {
  const node = doc as TiptapNode
  if (!node || typeof node !== 'object') return ''
  const lines: string[] = []
  for (const child of node.content ?? []) {
    switch (child.type) {
      case 'heading':
        lines.push(indent + '#'.repeat((child.attrs?.level ?? 1) + 1) + ' ' + inline(child))
        break
      case 'paragraph': {
        const text = inline(child)
        if (text) lines.push(indent + text)
        break
      }
      case 'bulletList':
        for (const li of child.content ?? []) lines.push(indent + '- ' + inline(li).trim())
        break
      case 'orderedList':
        (child.content ?? []).forEach((li, i) => lines.push(`${indent}${i + 1}. ` + inline(li).trim()))
        break
      case 'taskList':
        for (const li of child.content ?? []) {
          lines.push(indent + `- [${li.attrs?.checked ? 'x' : ' '}] ` + inline(li).trim())
        }
        break
      case 'blockquote':
        lines.push(indent + '> ' + inline(child))
        break
      default: {
        const text = inline(child)
        if (text) lines.push(indent + text)
      }
    }
  }
  return lines.join('\n')
}

function cardToMarkdown(state: DocState, card: Card, depth: number): string {
  const c = card.content
  switch (c.kind) {
    case 'note':
      return tiptapToMarkdown(c.doc)
    case 'todo': {
      const items = c.items
        .filter((i) => i.text)
        .map((i) => `- [${i.done ? 'x' : ' '}] ${i.text}`)
        .join('\n')
      return (c.title ? `**${c.title}**\n` : '') + items
    }
    case 'link':
      return `[${c.title || c.url}](${c.url})${c.description ? ' — ' + c.description : ''}`
    case 'image': {
      const pins = c.pins
        .map((p, i) => `> 📍 ${i + 1}. **${p.author}:** ${p.text}${p.replies.map((r) => `\n>    ↳ **${r.author}:** ${r.text}`).join('')}`)
        .join('\n')
      return `*[image${c.caption ? ': ' + c.caption : ''}]*${pins ? '\n' + pins : ''}`
    }
    case 'file':
      return `*[file: ${c.name}]*`
    case 'comment': {
      const replies = c.replies.map((r) => `> ↳ **${r.author}:** ${r.text}`).join('\n')
      return `> 💬 **${c.author}:** ${c.text}${replies ? '\n' + replies : ''}`
    }
    case 'table': {
      const [head, ...rows] = c.rows
      if (!head) return ''
      const md = [
        '| ' + head.join(' | ') + ' |',
        '| ' + head.map(() => '---').join(' | ') + ' |',
        ...rows.map((r) => '| ' + r.join(' | ') + ' |'),
      ]
      return md.join('\n')
    }
    case 'swatch':
      return `\`${c.hex}\`${c.name ? ' ' + c.name : ''}`
    case 'sticky':
      return c.text ? `🟨 ${c.text}` : ''
    case 'shape':
      return c.text ? `◇ ${c.text}` : ''
    case 'column': {
      const members = columnCards(state, card.id)
      const inner = members
        .map((m) => cardToMarkdown(state, m, depth))
        .filter(Boolean)
        .join('\n\n')
      return `${'#'.repeat(Math.min(6, depth + 2))} ${c.title || 'Column'}\n\n${inner}`
    }
    case 'chart': {
      const [head, ...rows] = c.rows
      const table = head
        ? [
            '| ' + head.join(' | ') + ' |',
            '| ' + head.map(() => '---').join(' | ') + ' |',
            ...rows.map((r) => '| ' + r.join(' | ') + ' |'),
          ].join('\n')
        : ''
      return (c.title ? `**${c.title}**\n\n` : '') + table
    }
    case 'board':
      return '' // handled by recursion in boardToMarkdown
    case 'ink':
      return '*[sketch]*'
  }
}

export function boardToMarkdown(state: DocState, boardId: string, depth = 0): string {
  const board = state.boards[boardId]
  if (!board) return ''
  const heading = '#'.repeat(Math.min(6, depth + 1)) + ' ' + board.title
  const cards = Object.values(state.cards)
    .filter((c) => c.boardId === boardId && !c.trashed && !c.inUnsorted && !c.colId)
    .sort((a, b) => a.y - b.y || a.x - b.x)

  const parts: string[] = [heading]
  for (const card of cards) {
    if (card.content.kind === 'board') {
      const childId = card.content.boardId
      if (state.boards[childId] && depth < 5) {
        parts.push(boardToMarkdown(state, childId, depth + 1))
      }
      continue
    }
    const md = cardToMarkdown(state, card, depth)
    if (md) parts.push(md)
  }
  return parts.join('\n\n')
}
