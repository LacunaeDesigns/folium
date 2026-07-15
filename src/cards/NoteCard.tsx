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
import { useFoliumStore } from '../store/context'
import { useEditing, useDebouncedCommit } from './useEditing'
import { Icon } from '../ui/Icons'

// Plain toggleBulletList()/toggleOrderedList() only flip the current list type
// on/off against a paragraph — switching from one list type to the other takes
// two clicks (toggle off, then toggle on). These instead convert directly:
// toggle the other type off first (if active) before toggling the target on.
// The two toggles MUST run as separate transactions (not chained into one
// .run()) — chaining both breaks silently (a no-op) when the selection is a
// ProseMirror AllSelection, i.e. after Ctrl+A/Cmd+A, even though each toggle
// works fine on its own with that same selection.
export function setBulletList(editor: Editor) {
  if (editor.isActive('orderedList')) {
    editor.chain().focus().toggleOrderedList().run()
  }
  editor.chain().focus().toggleBulletList().run()
}

export function setOrderedList(editor: Editor) {
  if (editor.isActive('bulletList')) {
    editor.chain().focus().toggleBulletList().run()
  }
  editor.chain().focus().toggleOrderedList().run()
}

function FormatBar({ editor, noteId, bg }: { editor: Editor; noteId: string; bg: string }) {
  const store = useFoliumStore()
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
      {btn('••', () => setBulletList(editor), editor.isActive('bulletList'), 'Bullet list')}
      {btn('1.', () => setOrderedList(editor), editor.isActive('orderedList'), 'Numbered list')}
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
  const store = useFoliumStore()
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
    editorProps: { attributes: { spellcheck: 'true' } },
    onUpdate: ({ editor }) => commit(editor.getJSON()),
  })

  React.useEffect(() => {
    if (!editor) return
    editor.setEditable(editing && !readOnly)
    if (editing) editor.commands.focus('end')
  }, [editing, editor, readOnly])

  // TipTap only reads `content` at mount — sync external doc changes (undo/redo,
  // backup import) into the editor while it is not being typed in, otherwise the
  // stale editor clobbers the undone content on the next keystroke
  React.useEffect(() => {
    if (!editor || editing) return
    if (!content.doc) {
      if (!editor.isEmpty) editor.commands.clearContent(false)
      return
    }
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(content.doc)) {
      editor.commands.setContent(content.doc as never, false)
    }
  }, [editor, editing, content.doc])

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
