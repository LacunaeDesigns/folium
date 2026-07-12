import React from 'react'
import { EditorContent, useEditor, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { CardBodyProps } from './registry'
import { NoteContent, NOTE_COLORS } from '../model/types'
import { useAtlasStore } from '../store/context'
import { useEditing, useDebouncedCommit } from './useEditing'
import { Icon } from '../ui/Icons'

function FormatBar({ editor, noteId, bg }: { editor: Editor; noteId: string; bg: string }) {
  const store = useAtlasStore()
  const btn = (
    label: React.ReactNode,
    action: () => void,
    active: boolean,
    title: string,
  ) => (
    <button
      className={'fmt-btn' + (active ? ' on' : '')}
      title={title}
      onMouseDown={(e) => {
        e.preventDefault()
        action()
      }}
    >
      {label}
    </button>
  )
  return (
    <div className="format-bar no-drag" onPointerDown={(e) => e.stopPropagation()}>
      {btn(<b>B</b>, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), 'Bold')}
      {btn(<i>I</i>, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), 'Italic')}
      {btn(<u>U</u>, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), 'Underline')}
      {btn(<s>S</s>, () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'), 'Strikethrough')}
      {btn('H1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }), 'Heading')}
      {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), 'Subheading')}
      {btn('••', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), 'Bullet list')}
      {btn('1.', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), 'Numbered list')}
      {btn('✓', () => editor.chain().focus().toggleTaskList().run(), editor.isActive('taskList'), 'Checklist')}
      {btn(
        <span className="hl-swatch" />,
        () => editor.chain().focus().toggleHighlight().run(),
        editor.isActive('highlight'),
        'Highlight',
      )}
      <span className="fmt-sep" />
      {NOTE_COLORS.map((c) => (
        <button
          key={c}
          className={'color-dot bg-' + c + (bg === c ? ' on' : '')}
          title={c}
          onMouseDown={(e) => {
            e.preventDefault()
            store.getState().updateContent(noteId, { bg: c })
          }}
        />
      ))}
    </div>
  )
}

export function NoteCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as NoteContent
  const store = useAtlasStore()
  const [editing, setEditing] = useEditing(card.id)
  const commit = useDebouncedCommit((doc) => store.getState().updateContent(card.id, { doc }))

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight,
      Underline,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Type something…' }),
    ],
    content: (content.doc as object) ?? '',
    editable: false,
    onUpdate: ({ editor }) => commit(editor.getJSON()),
  })

  React.useEffect(() => {
    if (!editor) return
    editor.setEditable(editing && !readOnly)
    if (editing) editor.commands.focus('end')
  }, [editing, editor, readOnly])

  const words = editor ? editor.getText().split(/\s+/).filter(Boolean).length : 0

  return (
    <div
      className={'note-card bg-' + content.bg}
      onDoubleClick={(e) => {
        if (readOnly) return
        e.stopPropagation()
        setEditing(true)
      }}
    >
      {editing && editor && <FormatBar editor={editor} noteId={card.id} bg={content.bg} />}
      <EditorContent editor={editor} className={'note-editor' + (editing ? ' editing' : '')} />
      {editing && words > 0 && <div className="note-words">{words} words</div>}
    </div>
  )
}
