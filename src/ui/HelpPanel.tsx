import React from 'react'
import { Icon, IconName } from './Icons'
import { useDb } from '../store/context'
import { useUpdateCheck, dismissUpdate } from '../store/updateCheck'
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
  { keys: 'Alt + drag', action: 'Duplicate the selection and drag the copies' },
  { keys: 'Escape', action: 'Close menus, clear the selection, or exit the current tool' },
]

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const db = useDb()
  const updateAvailable = useUpdateCheck((s) => s.available)
  const [activeSection, setActiveSection] = React.useState('start')

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
          <nav className="help-toc">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
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
              <section id="help-start">
                <h2>Getting started</h2>
                <p>Cards live on boards. Pick a tool from the toolbar, then click the canvas to place a card.</p>
                <p>Double-click an empty spot on the canvas to drop a quick note there.</p>
              </section>
            )}

            {activeSection === 'cards' && (
              <section id="help-cards">
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
              <section id="help-nav">
                <h2>Navigating</h2>
                <p>Pan the canvas by holding Space and dragging, or by dragging with the middle mouse button.</p>
                <p>Zoom by holding Ctrl and scrolling the wheel.</p>
                <p>
                  Use the View menu, or Shift+1, to fit the whole board in view. Use Shift+2 to zoom to the
                  current selection.
                </p>
              </section>
            )}

            {activeSection === 'select' && (
              <section id="help-select">
                <h2>Selecting & moving</h2>
                <p>Drag on empty canvas to draw a marquee and select the cards inside it.</p>
                <p>Click a card to select it, and shift-click to add more cards to the selection.</p>
                <p>Hold Alt while dragging a selection to duplicate it and drag the copies, leaving the originals in place.</p>
                <p>
                  Dragging a card shows snap guides against nearby cards. Hold Ctrl while dragging to move
                  freely, ignoring the guides.
                </p>
              </section>
            )}

            {activeSection === 'lines' && (
              <section id="help-lines">
                <h2>Lines & connections</h2>
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
              <section id="help-boards">
                <h2>Boards, columns & frames</h2>
                <p>A board card opens a nested board of its own, so you can organise work in layers.</p>
                <p>A column holds other cards in a vertical list and can be collapsed to save space.</p>
                <p>A frame is a labelled section: cards placed inside it move and resize together with the frame.</p>
              </section>
            )}

            {activeSection === 'templates' && (
              <section id="help-templates">
                <h2>Templates</h2>
                <p>Open the template gallery from the top bar to start a new board from a built-in layout.</p>
                <p>You can also save the board you are currently on as your own template, to reuse later.</p>
              </section>
            )}

            {activeSection === 'io' && (
              <section id="help-io">
                <h2>Import & export</h2>
                <p>
                  Import Markdown files from the Export menu, or drag a <code>.md</code> file onto a board.
                  Each file becomes a new board: headings and paragraphs become notes, checklists become
                  to-do cards, pipe tables become table cards, and images and links become their own cards.
                  Markdown import cannot bring across layout, colours or embedded images.
                </p>
                <p>From the Export menu you can also export the current board as an HTML file (which can be printed to PDF), or as Markdown.</p>
                <p>
                  Back up all data as a single JSON file, and restore it later with Import backup — this
                  replaces all current boards, cards and files, so use it for moving your whole workspace
                  between machines.
                </p>
              </section>
            )}

            {activeSection === 'photos' && (
              <section id="help-photos">
                <h2>Photos via Pexels</h2>
                <p>
                  Get a free API key from pexels.com/api and paste it into Settings to search and add
                  photos straight onto a board.
                </p>
                <p>The key is stored only in this browser and is never included in exports or synced elsewhere.</p>
              </section>
            )}

            {activeSection === 'sync' && (
              <section id="help-sync">
                <h2>Cross-machine sync</h2>
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
              <section id="help-live">
                <h2>Live review</h2>
                <p>
                  Start a live session from the top bar to get a session code. Reviewers open the exported
                  HTML file of this board, click “Join live session” and enter the code — their comments
                  then land on this board live.
                </p>
              </section>
            )}

            {activeSection === 'keys' && (
              <section id="help-keys">
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
              <section id="help-feedback">
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
