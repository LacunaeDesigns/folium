import { Template } from '../model/types'
import { buildTemplate, noteDoc, todoItems } from './builder'
import { EXTRA_TEMPLATES } from './builtins-extra'

const storyboard = buildTemplate(
  {
    id: 'builtin-storyboard',
    name: 'Storyboard',
    category: 'Filmmaking & video',
    description: 'Scene columns with frames, shot notes and a script — plan any sequence shot by shot.',
  },
  (s, b) => {
    s.addCard(b, 'note', {
      x: 40,
      y: 40,
      content: {
        doc: noteDoc(
          '# Storyboard',
          'One column per scene. Drop frame sketches or reference stills into each column, and keep shot notes underneath.',
        ),
      } as never,
    })
    s.setBoardMeta(b, { color: '#d4589c', icon: 'image' })
    const scenes = ['Scene 1 — Opening', 'Scene 2 — Build', 'Scene 3 — Payoff']
    scenes.forEach((title, i) => {
      const col = s.addCard(b, 'column', { x: 40 + i * 310, y: 190, content: { title } as never })
      const img = s.addCard(b, 'image', { x: 0, y: 0 })
      const note = s.addCard(b, 'note', {
        x: 0,
        y: 0,
        content: { doc: noteDoc('## Shot notes', 'Camera, movement, dialogue…') } as never,
      })
      s.setCardColumn(img, col, 0)
      s.setCardColumn(note, col, 1)
    })
    s.addCard(b, 'note', {
      x: 1000,
      y: 190,
      w: 280,
      content: { doc: noteDoc('# Script', 'Paste the relevant script section here to keep it in view.'), bg: 'blue' } as never,
    })
    s.addCard(b, 'todo', {
      x: 1000,
      y: 380,
      content: { title: 'Shot list', items: todoItems('Establishing shot', 'Close-up reaction', 'Insert shot') } as never,
    })
  },
)

const worldBuilding = buildTemplate(
  {
    id: 'builtin-world-building',
    name: 'World Building',
    category: 'Game development',
    description: 'Regions, factions, characters and lore as connected sub-boards around your world bible.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#4caf6e', icon: 'draw' })
    s.addCard(b, 'note', {
      x: 340,
      y: 40,
      w: 300,
      content: {
        doc: noteDoc(
          '# World Bible',
          'The single source of truth for your world. Keep the rules here; let each sub-board go deep.',
          '',
          '## Tone',
          'Three adjectives that everything must pass through.',
        ),
      } as never,
    })
    const regions = s.createBoard(b, 'Regions & Places', { x: 60, y: 320 })
    const factions = s.createBoard(b, 'Factions', { x: 300, y: 320 })
    const chars = s.createBoard(b, 'Characters', { x: 540, y: 320 })
    const lore = s.createBoard(b, 'Lore & History', { x: 780, y: 320 })
    s.addCard(regions.boardId, 'note', { x: 40, y: 40, content: { doc: noteDoc('# Regions', 'One board or note per region.') } as never })
    s.addCard(factions.boardId, 'note', { x: 40, y: 40, content: { doc: noteDoc('# Factions', 'Goals, methods, symbols.') } as never })
    s.addCard(chars.boardId, 'note', { x: 40, y: 40, content: { doc: noteDoc('# Characters', 'Wants vs. needs. Ties to factions.') } as never })
    s.addCard(lore.boardId, 'note', { x: 40, y: 40, content: { doc: noteDoc('# Timeline', 'Era by era. What broke, who remembers.') } as never })
    s.addLine(b, { cardId: regions.cardId }, { cardId: factions.cardId })
    s.addLine(b, { cardId: factions.cardId }, { cardId: chars.cardId })
    s.addLine(b, { cardId: chars.cardId }, { cardId: lore.cardId })
    s.addCard(b, 'sticky', { x: 60, y: 60, content: { text: 'Start here ➜', color: 'yellow' } as never })
    s.addCard(b, 'swatch', { x: 720, y: 40, content: { hex: '#3d5a45', name: 'World palette' } as never })
    s.addCard(b, 'todo', {
      x: 960,
      y: 40,
      content: { title: 'Open questions', items: todoItems('How does magic cost?', 'Who profits from the war?') } as never,
    })
  },
)

const gameDev = buildTemplate(
  {
    id: 'builtin-game-dev',
    name: 'Game Development',
    category: 'Game development',
    description: 'GDD hub with mechanics, level design and art direction boards plus a task pipeline.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#8e5cd9', icon: 'board' })
    s.addCard(b, 'note', {
      x: 40,
      y: 40,
      w: 320,
      content: {
        doc: noteDoc(
          '# Game Design Doc',
          '## Pitch',
          'One sentence. Verb first.',
          '## Pillars',
          'Three pillars every feature must serve.',
        ),
      } as never,
    })
    const mech = s.createBoard(b, 'Mechanics', { x: 420, y: 60 })
    const level = s.createBoard(b, 'Level Design', { x: 620, y: 60 })
    const art = s.createBoard(b, 'Art Direction', { x: 820, y: 60 })
    s.createBoard(b, 'Narrative', { x: 1020, y: 60 })
    s.addCard(mech.boardId, 'note', { x: 40, y: 40, content: { doc: noteDoc('# Core loop', 'Do → get → unlock → do.') } as never })
    s.addCard(level.boardId, 'note', { x: 40, y: 40, content: { doc: noteDoc('# Level beats', 'Teach, test, twist, pay off.') } as never })
    s.addCard(art.boardId, 'note', { x: 40, y: 40, content: { doc: noteDoc('# Art direction', 'References and palette here.') } as never })
    const cols = ['Backlog', 'In progress', 'Done']
    cols.forEach((title, i) => {
      const col = s.addCard(b, 'column', { x: 420 + i * 300, y: 330, content: { title } as never })
      if (i === 0) {
        const t1 = s.addCard(b, 'todo', { x: 0, y: 0, content: { title: 'Prototype', items: todoItems('Greybox level 1', 'Player controller feel pass') } as never })
        s.setCardColumn(t1, col, 0)
      }
    })
    s.addCard(b, 'table', {
      x: 40,
      y: 330,
      w: 340,
      content: { rows: [['Milestone', 'Date'], ['Vertical slice', ''], ['Alpha', ''], ['Beta', '']] } as never,
    })
    s.addCard(b, 'sticky', { x: 40, y: 560, content: { text: 'Playtest every Friday', color: 'green' } as never })
  },
)

const portfolioReview = buildTemplate(
  {
    id: 'builtin-portfolio-review',
    name: 'Portfolio Review',
    category: 'Review',
    description: 'Candidate info, work samples, scoring rubric, strengths/improvements and a verdict — duplicate per candidate.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#e56937', icon: 'image' })
    s.addCard(b, 'note', {
      x: 40,
      y: 40,
      w: 300,
      content: {
        doc: noteDoc(
          '# Candidate',
          'Name:',
          'Role: Level Designer',
          'Portfolio link:',
          'Date reviewed:',
        ),
        bg: 'blue',
      } as never,
    })
    const samples = s.addCard(b, 'column', { x: 380, y: 40, content: { title: 'Work samples' } as never })
    const img1 = s.addCard(b, 'image', { x: 0, y: 0 })
    const img2 = s.addCard(b, 'image', { x: 0, y: 0 })
    s.setCardColumn(img1, samples, 0)
    s.setCardColumn(img2, samples, 1)
    const notes = s.addCard(b, 'column', { x: 690, y: 40, content: { title: 'Notes per piece' } as never })
    const n1 = s.addCard(b, 'note', { x: 0, y: 0, content: { doc: noteDoc('## Piece 1', 'Drop comment pins on the image, summarize here.') } as never })
    s.setCardColumn(n1, notes, 0)
    s.addCard(b, 'table', {
      x: 40,
      y: 330,
      w: 420,
      content: {
        rows: [
          ['Criteria', 'Score /5', 'Notes'],
          ['Layout & flow', '', ''],
          ['Pacing & beats', '', ''],
          ['Readability', '', ''],
          ['Documentation', '', ''],
          ['Presentation', '', ''],
        ],
      } as never,
    })
    const strengths = s.addCard(b, 'column', { x: 500, y: 330, content: { title: 'Strengths' } as never })
    const sSticky = s.addCard(b, 'sticky', { x: 0, y: 0, content: { text: '', color: 'green' } as never })
    s.setCardColumn(sSticky, strengths, 0)
    const improve = s.addCard(b, 'column', { x: 810, y: 330, content: { title: 'To improve' } as never })
    const iSticky = s.addCard(b, 'sticky', { x: 0, y: 0, content: { text: '', color: 'orange' } as never })
    s.setCardColumn(iSticky, improve, 0)
    s.addCard(b, 'note', {
      x: 40,
      y: 640,
      w: 420,
      content: { doc: noteDoc('# Verdict', 'Overall impression and recommendation.'), bg: 'yellow' } as never,
    })
    s.addCard(b, 'todo', {
      x: 500,
      y: 640,
      content: { title: 'Feedback to send', items: todoItems('Export this board as HTML', 'Share over chat') } as never,
    })
  },
)

const moodboard = buildTemplate(
  {
    id: 'builtin-moodboard',
    name: 'Moodboard',
    category: 'Design',
    description: 'Images, color swatches and references to set a visual direction.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#d64541', icon: 'image' })
    s.addCard(b, 'note', {
      x: 40,
      y: 40,
      content: { doc: noteDoc('# Moodboard', 'Collect anything that feels right. Cull weekly.') } as never,
    })
    const hexes = ['#ffbf00', '#d42511', '#257ef4', '#3d3d3b', '#efe9df']
    hexes.forEach((hex, i) => {
      s.addCard(b, 'swatch', { x: 40 + i * 216, y: 200, content: { hex, name: '' } as never })
    })
    for (let i = 0; i < 6; i++) {
      s.addCard(b, 'image', { x: 40 + (i % 3) * 300, y: 380 + Math.floor(i / 3) * 260 })
    }
    s.addCard(b, 'link', { x: 960, y: 380, content: { url: '', title: '', description: '' } as never })
    s.addCard(b, 'sticky', { x: 960, y: 200, content: { text: 'Keywords: bold, warm, tactile', color: 'yellow' } as never })
  },
)

const projectPlan = buildTemplate(
  {
    id: 'builtin-project-plan',
    name: 'Project Plan',
    category: 'Planning',
    description: 'Everything about a project in one place: brief, pipeline columns, budget and ideas board.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#4c6ef5', icon: 'todo' })
    s.addCard(b, 'note', {
      x: 40,
      y: 40,
      w: 300,
      content: {
        doc: noteDoc('# About the project', 'What it is, who it serves, when it ships.', '', '## Success looks like', '…'),
      } as never,
    })
    const cols = ['To do', 'Doing', 'Done']
    cols.forEach((title, i) => {
      const col = s.addCard(b, 'column', { x: 380 + i * 300, y: 40, content: { title } as never })
      if (i === 0) {
        const t = s.addCard(b, 'todo', { x: 0, y: 0, content: { title: 'Kickoff', items: todoItems('Define scope', 'Set milestones') } as never })
        s.setCardColumn(t, col, 0)
      }
    })
    s.addCard(b, 'table', {
      x: 40,
      y: 330,
      w: 340,
      content: {
        rows: [
          ['Item', 'Cost'],
          ['Equipment & gear', ''],
          ['Crew & labor', ''],
          ['Marketing', ''],
        ],
      } as never,
    })
    s.createBoard(b, 'Ideas', { x: 420, y: 360 })
    s.addCard(b, 'comment', { x: 640, y: 360, content: { text: 'Drop status updates here.' } as never })
  },
)

const brainstorm = buildTemplate(
  {
    id: 'builtin-brainstorm',
    name: 'Brainstorm',
    category: 'Thinking',
    description: 'A center topic with radiating stickies and space to diverge before you converge.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#e8b93c', icon: 'draw' })
    const center = s.addCard(b, 'shape', {
      x: 460,
      y: 260,
      content: { shape: 'ellipse', fill: 'yellow', text: 'TOPIC' } as never,
    })
    const spots = [
      { x: 160, y: 80 }, { x: 480, y: 40 }, { x: 800, y: 80 },
      { x: 140, y: 420 }, { x: 800, y: 420 }, { x: 480, y: 520 },
    ]
    const colors = ['yellow', 'green', 'blue', 'orange', 'purple', 'red']
    spots.forEach((at, i) => {
      const sticky = s.addCard(b, 'sticky', { ...at, content: { text: '', color: colors[i] } as never })
      s.addLine(b, { cardId: center }, { cardId: sticky })
    })
    s.addCard(b, 'note', {
      x: 40,
      y: 600,
      w: 340,
      content: {
        doc: noteDoc('## Rules', 'Quantity over quality. Build on ideas with “yes, and”. Judge nothing until the timer ends.'),
      } as never,
    })
    s.addCard(b, 'todo', {
      x: 440,
      y: 640,
      content: { title: 'Converge', items: todoItems('Cluster similar stickies', 'Vote top 3', 'Turn winners into actions') } as never,
    })
  },
)

export const BUILTIN_TEMPLATES: Template[] = [
  portfolioReview,
  storyboard,
  worldBuilding,
  gameDev,
  moodboard,
  projectPlan,
  brainstorm,
  ...EXTRA_TEMPLATES,
]
