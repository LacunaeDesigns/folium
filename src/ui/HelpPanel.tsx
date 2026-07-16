import React from 'react'
import { Icon, IconName } from './Icons'
import { useDb } from '../store/context'
import { useUpdateCheck, dismissUpdate } from '../store/updateCheck'
import { FlowDiagram, LinesDiagram, BoardsColumnsFramesDiagram } from './HelpDiagrams'
import './panels.css'

const SECTIONS: { id: string; title: string }[] = [
  { id: 'start', title: 'Getting started' },
  { id: 'cards', title: 'Card types' },
  { id: 'nav', title: 'Navigating' },
  { id: 'select', title: 'Selecting & moving' },
  { id: 'lines', title: 'Lines & connections' },
  { id: 'boards', title: 'Boards, columns & frames' },
  { id: 'templates', title: 'Templates' },
  { id: 'io', title: 'Import & export' },
  { id: 'photos', title: 'Photos via Pexels' },
  { id: 'sync', title: 'Cross-machine sync' },
  { id: 'live', title: 'Live review' },
  { id: 'keys', title: 'Keyboard shortcuts' },
  { id: 'feedback', title: 'Feedback & bugs' },
]

const CARD_TYPES: { icon: IconName; name: string; desc: string }[] = [
  { icon: 'note', name: 'Note', desc: 'A rich-text note. Type, format and add links.' },
  { icon: 'sticky', name: 'Sticky', desc: 'A single-color note for quick, short text.' },
  { icon: 'todo', name: 'To-do', desc: 'A titled checklist you can tick off item by item.' },
  { icon: 'link', name: 'Link', desc: 'A bookmark card with a title and description.' },
  { icon: 'image', name: 'Image', desc: 'A picture, with an optional caption and comment pins.' },
  { icon: 'table', name: 'Table', desc: 'A grid of cells, with the first row as the header.' },
  { icon: 'chart', name: 'Chart', desc: 'A bar, line, pie or donut chart built from a row of data.' },
  { icon: 'heading', name: 'Heading', desc: 'A large H1, H2 or H3 line of text for labelling a board.' },
  { icon: 'column', name: 'Column', desc: 'A vertical list that holds other cards and can be collapsed.' },
  { icon: 'frame', name: 'Frame', desc: 'A labelled section that groups nearby cards and moves them together.' },
  { icon: 'board', name: 'Board', desc: 'A card that opens a nested board of its own.' },
  { icon: 'comment', name: 'Comment', desc: 'A note with threaded replies, useful for feedback.' },
  { icon: 'swatch', name: 'Swatch', desc: 'A named colour chip, for keeping a palette on the board.' },
  { icon: 'shape', name: 'Shape', desc: 'A rectangle, ellipse or diamond, with optional text inside.' },
  { icon: 'upload', name: 'File', desc: 'An uploaded file, shown with its name and size.' },
  { icon: 'draw', name: 'Ink', desc: 'A freehand drawing made with the pen tool.' },
]

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl+K', action: 'Open search' },
  { keys: 'Alt+N', action: 'Quick capture a note to Inbox' },
  { keys: 'Ctrl+S', action: 'Save/sync now' },
  { keys: 'Ctrl+Z', action: 'Undo' },
  { keys: 'Ctrl+Shift+Z / Ctrl+Y', action: 'Redo' },
  { keys: 'Ctrl+D', action: 'Duplicate the selection' },
  { keys: 'Ctrl+C', action: 'Copy the selection' },
  { keys: 'Ctrl+X', action: 'Cut the selection' },
  { keys: 'Ctrl+A', action: 'Select all cards on the board' },
  { keys: 'Delete / Backspace', action: 'Move the selection (or selected line) to trash' },
  { keys: 'Arrow keys', action: 'Nudge the selection (hold Shift for a bigger step)' },
  { keys: 'Space + drag', action: 'Pan the canvas' },
  { keys: 'Middle-mouse drag', action: 'Pan the canvas' },
  { keys: 'Ctrl + wheel', action: 'Zoom in or out' },
  { keys: 'Shift+1', action: 'Fit the whole board in view' },
  { keys: 'Shift+2', action: 'Zoom to the current selection' },
  { keys: 'Ctrl+]', action: 'Bring the selection to front' },
  { keys: 'Ctrl+[', action: 'Send the selection to back' },
  { keys: 'Ctrl+Alt+]', action: 'Bring the selected card forward one step' },
  { keys: 'Ctrl+Alt+[', action: 'Send the selected card backward one step' },
  { keys: 'Alt + drag', action: 'Duplicate the selection and drag the copies' },
  { keys: 'Escape', action: 'Close menus, clear the selection, or exit the current tool' },
]

/** Roving-tabindex arrow-key navigation for the Help sidebar's tab list. */
export function nextSectionIndex(current: number, key: string, count: number): number | null {
  if (key === 'ArrowDown') return (current + 1) % count
  if (key === 'ArrowUp') return (current - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const db = useDb()
  const updateAvailable = useUpdateCheck((s) => s.available)
  const [activeSection, setActiveSection] = React.useState('start')
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onTocKeyDown = (e: React.KeyboardEvent) => {
    const idx = SECTIONS.findIndex((s) => s.id === activeSection)
    const next = nextSectionIndex(idx, e.key, SECTIONS.length)
    if (next === null) return
    e.preventDefault()
    const id = SECTIONS[next].id
    setActiveSection(id)
    tabRefs.current[id]?.focus()
  }

  return (
    <div className="overlay" onPointerDown={onClose}>
      <div className="help-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="tray-head">
          <Icon name="help" size={16} />
          <span className="tray-title">Help</span>
          <button className="icon-btn" onClick={onClose} title="Close">
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="help-body">
          <nav
            className="help-toc"
            role="tablist"
            aria-label="Help sections"
            aria-orientation="vertical"
            onKeyDown={onTocKeyDown}
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                ref={(el) => {
                  tabRefs.current[s.id] = el
                }}
                role="tab"
                id={'tab-' + s.id}
                aria-selected={activeSection === s.id}
                aria-controls={'help-' + s.id}
                tabIndex={activeSection === s.id ? 0 : -1}
                className={'help-toc-item' + (activeSection === s.id ? ' active' : '')}
                onClick={() => setActiveSection(s.id)}
              >
                {s.title}
              </button>
            ))}
          </nav>
          <div className="help-content">
            {updateAvailable && (
              <div className="help-update-banner">
                <span>A newer version of Folium is available.</span>
                <a href="https://github.com/LacunaeDesigns/folium" target="_blank" rel="noreferrer">
                  View on GitHub
                </a>
                <button className="chrome-btn" onClick={() => void dismissUpdate(db)}>
                  Dismiss
                </button>
              </div>
            )}
            {activeSection === 'start' && (
              <section id="help-start" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Getting started</h2>
                <p className="help-tip">
                  <Icon name="plus" size={14} />
                  <span>Cards live on boards. Pick a tool from the toolbar, then click the canvas to place a card.</span>
                </p>
                <p className="help-tip">
                  <Icon name="note" size={14} />
                  <span>Double-click an empty spot on the canvas to drop a quick note there.</span>
                </p>
              </section>
            )}

            {activeSection === 'cards' && (
              <section id="help-cards" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Card types</h2>
                <ul className="help-card-list">
                  {CARD_TYPES.map((c) => (
                    <li key={c.name}>
                      <Icon name={c.icon} size={15} />
                      <span>
                        <b>{c.name}.</b> {c.desc}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {activeSection === 'nav' && (
              <section id="help-nav" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Navigating</h2>
                <p>Pan the canvas by holding Space and dragging, or by dragging with the middle mouse button.</p>
                <p className="help-tip">
                  <Icon name="zoom-in" size={14} />
                  <span>Zoom by holding Ctrl and scrolling the wheel.</span>
                </p>
                <p className="help-tip">
                  <Icon name="fit" size={14} />
                  <span>
                    Use the View menu, or Shift+1, to fit the whole board in view. Use Shift+2, or the zoom
                    pill&apos;s fifth button, to zoom to the current selection.
                  </span>
                </p>
                <p className="help-tip">
                  <Icon name="search" size={14} />
                  <span>
                    Ctrl+K opens search across every board. Filter results by card type or restrict them to
                    the current board, and use &quot;Show more&quot; to page past the first 30 matches.
                  </span>
                </p>
              </section>
            )}

            {activeSection === 'select' && (
              <section id="help-select" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Selecting & moving</h2>
                <p>Drag on empty canvas to draw a marquee and select the cards inside it.</p>
                <p>Click a card to select it, and shift-click to add more cards to the selection.</p>
                <p className="help-tip">
                  <Icon name="duplicate" size={14} />
                  <span>Hold Alt while dragging a selection to duplicate it and drag the copies, leaving the originals in place.</span>
                </p>
                <p>
                  Dragging a card shows snap guides against nearby cards. Hold Ctrl while dragging to move
                  freely, ignoring the guides.
                </p>
                <p>
                  With cards selected, the Arrange menu in the top bar (or a right-click) aligns and
                  distributes them and reorders their front-to-back stacking.
                </p>
                <p className="help-tip">
                  <Icon name="lock" size={14} />
                  <span>
                    Right-click a card and choose Lock to stop it from being dragged, resized or
                    deleted. A locked card still shows a badge and can be selected — right-click it
                    again to unlock.
                  </span>
                </p>
              </section>
            )}

            {activeSection === 'lines' && (
              <section id="help-lines" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Lines & connections</h2>
                <LinesDiagram />
                <p>Drag from a card's edge handle to another card to connect them with a line.</p>
                <p>
                  The line end snaps to the nearest edge-centre of the target card if you drop within 26
                  pixels of it. Hold Ctrl while dropping to place the end freely instead.
                </p>
                <p>
                  Select a line to open its toolbar: toggle arrowheads at either end, switch between a
                  straight or curved line, add a label, set a thin or thick width, toggle a dashed stroke,
                  and pick a colour.
                </p>
              </section>
            )}

            {activeSection === 'boards' && (
              <section id="help-boards" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Boards, columns & frames</h2>
                <BoardsColumnsFramesDiagram />
                <p>A board card opens a nested board of its own, so you can organise work in layers.</p>
                <p>A column holds other cards in a vertical list and can be collapsed to save space.</p>
                <p>A frame is a labelled section: cards placed inside it move and resize together with the frame.</p>
              </section>
            )}

            {activeSection === 'templates' && (
              <section id="help-templates" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Templates</h2>
                <p className="help-tip">
                  <Icon name="template" size={14} />
                  <span>Open the template gallery from the top bar to start a new board from a built-in layout.</span>
                </p>
                <p>You can also save the board you are currently on as your own template, to reuse later.</p>
              </section>
            )}

            {activeSection === 'io' && (
              <section id="help-io" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Import & export</h2>
                <p className="help-tip">
                  <Icon name="download" size={14} />
                  <span>
                    Import Markdown files from the Export menu, or drag a <code>.md</code> file onto a board.
                    Each file becomes a new board: headings and paragraphs become notes, checklists become
                    to-do cards, pipe tables become table cards, and images and links become their own cards.
                    Markdown import cannot bring across layout, colours or embedded images.
                  </span>
                </p>
                <p className="help-tip">
                  <Icon name="export" size={14} />
                  <span>From the Export menu you can also export the current board as an HTML file (which can be printed to PDF), or as Markdown.</span>
                </p>
                <p className="help-tip">
                  <Icon name="restore" size={14} />
                  <span>
                    Back up all data as a single JSON file, and restore it later with Import backup — this
                    replaces all current boards, cards and files, so use it for moving your whole workspace
                    between machines.
                  </span>
                </p>
              </section>
            )}

            {activeSection === 'photos' && (
              <section id="help-photos" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Photos via Pexels</h2>
                <p className="help-tip">
                  <Icon name="image" size={14} />
                  <span>
                    Get a free API key from pexels.com/api and paste it into Settings to search and add
                    photos straight onto a board.
                  </span>
                </p>
                <p>The key is stored only in this browser and is never included in exports or synced elsewhere.</p>
              </section>
            )}

            {activeSection === 'sync' && (
              <section id="help-sync" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Cross-machine sync</h2>
                <FlowDiagram
                  steps={[
                    { label: 'Home', color: 'var(--accent)' },
                    { label: 'Folder', color: 'var(--accent-orange)' },
                    { label: 'Work', color: 'var(--accent)' },
                  ]}
                />
                <p>
                  In Settings, link a folder inside a synced location such as OneDrive, Google Drive,
                  Dropbox or iCloud, and Folium keeps your whole workspace saved there so it appears on
                  your other machines.
                </p>
                <p>
                  This needs Chrome or Edge. Use the linked folder from one machine at a time —
                  finish editing and wait for the toolbar to say “Saved” before switching. If you
                  see “Sync conflict,” it means this machine's edits weren't pushed because the
                  folder had already moved on elsewhere — nothing is lost, your edits are still
                  saved locally, but open Settings and either reload to get the newer version, or
                  wait for the other machine to settle and try syncing again.
                </p>
              </section>
            )}

            {activeSection === 'live' && (
              <section id="help-live" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Live review</h2>
                <FlowDiagram
                  steps={[
                    { label: 'This board', color: 'var(--accent)' },
                    { label: 'Export', color: 'var(--accent-orange)' },
                    { label: 'Reviewer', color: 'var(--accent)' },
                    { label: 'Comments back', color: 'var(--accent-orange)' },
                  ]}
                />
                <p>
                  Start a live session from the top bar to get a session code. Reviewers open the exported
                  HTML file of this board, click “Join live session” and enter the code — their comments
                  then land on this board live.
                </p>
              </section>
            )}

            {activeSection === 'keys' && (
              <section id="help-keys" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Keyboard shortcuts</h2>
                <table className="help-keys-table">
                  <tbody>
                    {SHORTCUTS.map((s) => (
                      <tr key={s.keys}>
                        <td><kbd>{s.keys}</kbd></td>
                        <td>{s.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {activeSection === 'feedback' && (
              <section id="help-feedback" role="tabpanel" aria-labelledby={'tab-' + activeSection}>
                <h2>Feedback & bugs</h2>
                <p>If something breaks, or Folium is missing something you need, open an issue on GitHub.</p>
                <div className="help-feedback-links">
                  <a
                    className="chrome-btn"
                    href="https://github.com/LacunaeDesigns/folium/issues/new"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Report a bug
                  </a>
                  <a
                    className="chrome-btn"
                    href="https://github.com/LacunaeDesigns/folium/issues/new"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Suggest a feature
                  </a>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
