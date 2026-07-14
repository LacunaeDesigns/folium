import { Template } from '../model/types'
import { buildTemplate, noteDoc, todoItems } from './builder'

// ---------- Research & writing ----------

const literatureReview = buildTemplate(
  {
    id: 'builtin-literature-review',
    name: 'Literature Review',
    category: 'Research & writing',
    description: 'Track sources through to-read, reading and synthesized stages with a claims table.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#3d7a68', icon: 'note' })
    s.addCard(b, 'note', {
      x: 40,
      y: 40,
      w: 300,
      content: { doc: noteDoc('# Literature Review', 'Question:', 'What gap are you filling?') } as never,
    })
    const toRead = s.addCard(b, 'column', { x: 380, y: 40, content: { title: 'To read' } as never })
    const reading = s.addCard(b, 'column', { x: 680, y: 40, content: { title: 'Reading' } as never })
    const synth = s.addCard(b, 'column', { x: 980, y: 40, content: { title: 'Synthesized' } as never })
    const t1 = s.addCard(b, 'todo', {
      x: 0,
      y: 0,
      content: { title: 'Sources', items: todoItems('Find 5 more sources', 'Check citations') } as never,
    })
    s.setCardColumn(t1, toRead, 0)
    const n1 = s.addCard(b, 'note', { x: 0, y: 0, content: { doc: noteDoc('## Currently reading', '') } as never })
    s.setCardColumn(n1, reading, 0)
    const n2 = s.addCard(b, 'note', { x: 0, y: 0, content: { doc: noteDoc('## Key takeaway', '') } as never })
    s.setCardColumn(n2, synth, 0)
    s.addCard(b, 'table', {
      x: 40,
      y: 330,
      w: 460,
      content: {
        rows: [
          ['Author', 'Year', 'Key claim', 'Relevance'],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
        ],
      } as never,
    })
    s.addCard(b, 'sticky', { x: 520, y: 330, content: { text: 'Research question:', color: 'yellow' } as never })
    s.addCard(b, 'todo', {
      x: 760,
      y: 330,
      content: { title: 'Next steps', items: todoItems('Draft synthesis', 'Identify gaps') } as never,
    })
  },
)

const essayOutline = buildTemplate(
  {
    id: 'builtin-essay-outline',
    name: 'Essay Outline',
    category: 'Research & writing',
    description: 'Thesis, intro/body/conclusion columns and an editing checklist for any piece of writing.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#c98a2b', icon: 'note' })
    s.addCard(b, 'heading', { x: 40, y: 40, w: 360, content: { text: 'Working Title', level: 1 } as never })
    s.addCard(b, 'note', {
      x: 40,
      y: 140,
      w: 360,
      content: { doc: noteDoc('## Thesis', 'One sentence claim the piece proves.') } as never,
    })
    const intro = s.addCard(b, 'column', { x: 440, y: 40, content: { title: 'Intro' } as never })
    const body = s.addCard(b, 'column', { x: 740, y: 40, content: { title: 'Body' } as never })
    const conclusion = s.addCard(b, 'column', { x: 1040, y: 40, content: { title: 'Conclusion' } as never })
    const hook = s.addCard(b, 'note', { x: 0, y: 0, content: { doc: noteDoc('## Hook', '') } as never })
    s.setCardColumn(hook, intro, 0)
    const p1 = s.addCard(b, 'note', { x: 0, y: 0, content: { doc: noteDoc('## Point 1', '') } as never })
    s.setCardColumn(p1, body, 0)
    const p2 = s.addCard(b, 'note', { x: 0, y: 0, content: { doc: noteDoc('## Point 2', '') } as never })
    s.setCardColumn(p2, body, 1)
    const take = s.addCard(b, 'note', { x: 0, y: 0, content: { doc: noteDoc('## Takeaway', '') } as never })
    s.setCardColumn(take, conclusion, 0)
    s.addCard(b, 'todo', {
      x: 40,
      y: 360,
      content: {
        title: 'Editing checklist',
        items: todoItems('Cut weak sentences', 'Check flow', 'Verify sources'),
      } as never,
    })
  },
)

const storyPlotBoard = buildTemplate(
  {
    id: 'builtin-story-plot-board',
    name: 'Story & Plot Board',
    category: 'Research & writing',
    description: 'Three-act beats plus a character want/need/arc table for planning fiction.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#7a4fb0', icon: 'draw' })
    s.addCard(b, 'heading', { x: 40, y: 40, content: { text: 'Story Title', level: 1 } as never })
    const act1 = s.addCard(b, 'column', { x: 40, y: 140, content: { title: 'Act 1' } as never })
    const act2 = s.addCard(b, 'column', { x: 340, y: 140, content: { title: 'Act 2' } as never })
    const act3 = s.addCard(b, 'column', { x: 640, y: 140, content: { title: 'Act 3' } as never })
    const s1 = s.addCard(b, 'sticky', { x: 0, y: 0, content: { text: 'Inciting incident', color: 'yellow' } as never })
    s.setCardColumn(s1, act1, 0)
    const s2 = s.addCard(b, 'sticky', { x: 0, y: 0, content: { text: 'Midpoint turn', color: 'orange' } as never })
    s.setCardColumn(s2, act2, 0)
    const s3 = s.addCard(b, 'sticky', { x: 0, y: 0, content: { text: 'Climax & resolution', color: 'red' } as never })
    s.setCardColumn(s3, act3, 0)
    s.addCard(b, 'table', {
      x: 960,
      y: 140,
      w: 360,
      content: {
        rows: [
          ['Character', 'Want', 'Need', 'Arc'],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
        ],
      } as never,
    })
    s.addCard(b, 'note', {
      x: 40,
      y: 460,
      w: 340,
      content: { doc: noteDoc('## Theme', 'What is this story really about?') } as never,
    })
  },
)

// ---------- Planning & productivity ----------

const weeklyPlanner = buildTemplate(
  {
    id: 'builtin-weekly-planner',
    name: 'Weekly Planner',
    category: 'Planning',
    description: 'A task column per weekday, a habit tracker and top priorities for the week.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#2f8fbf', icon: 'todo' })
    s.addCard(b, 'heading', { x: 40, y: 40, content: { text: 'Week of ___', level: 1 } as never })
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    days.forEach((title, i) => {
      const col = s.addCard(b, 'column', { x: 40 + i * 220, y: 140, content: { title } as never })
      const t = s.addCard(b, 'todo', { x: 0, y: 0, content: { title: 'Tasks', items: [] } as never })
      s.setCardColumn(t, col, 0)
    })
    s.addCard(b, 'table', {
      x: 40,
      y: 460,
      w: 300,
      content: {
        rows: [
          ['Habit', 'Streak'],
          ['', ''],
          ['', ''],
        ],
      } as never,
    })
    s.addCard(b, 'sticky', { x: 380, y: 460, content: { text: 'Top 3 priorities this week', color: 'yellow' } as never })
  },
)

const kanbanSprint = buildTemplate(
  {
    id: 'builtin-kanban-sprint',
    name: 'Kanban Sprint',
    category: 'Planning',
    description: 'Backlog through Done columns for running a sprint, with a goal/status table.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#3d8f5f', icon: 'todo' })
    s.addCard(b, 'note', {
      x: 40,
      y: 40,
      w: 300,
      content: { doc: noteDoc('# Sprint', 'Goal:', 'Dates:') } as never,
    })
    const cols = ['Backlog', 'In Progress', 'Review', 'Done']
    cols.forEach((title, i) => {
      const col = s.addCard(b, 'column', { x: 380 + i * 300, y: 40, content: { title } as never })
      if (i === 0) {
        const t = s.addCard(b, 'todo', { x: 0, y: 0, content: { title: 'Stories', items: todoItems('Story A', 'Story B') } as never })
        s.setCardColumn(t, col, 0)
      }
      if (i === 1) {
        const t = s.addCard(b, 'todo', { x: 0, y: 0, content: { title: 'Stories', items: todoItems('Story C') } as never })
        s.setCardColumn(t, col, 0)
      }
    })
    s.addCard(b, 'table', {
      x: 40,
      y: 330,
      w: 340,
      content: {
        rows: [
          ['Sprint goal', 'Status'],
          ['', ''],
        ],
      } as never,
    })
  },
)

const meetingNotesHub = buildTemplate(
  {
    id: 'builtin-meeting-notes-hub',
    name: 'Meeting Notes Hub',
    category: 'Planning',
    description: 'Agenda, attendees, action items, decisions and a parking lot for one meeting.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#5c6fae', icon: 'note' })
    s.addCard(b, 'note', {
      x: 40,
      y: 40,
      w: 340,
      content: { doc: noteDoc('# Meeting notes', 'Date:', 'Attendees:', 'Purpose:') } as never,
    })
    s.addCard(b, 'table', {
      x: 420,
      y: 40,
      w: 300,
      content: {
        rows: [
          ['Attendee', 'Role'],
          ['', ''],
          ['', ''],
          ['', ''],
        ],
      } as never,
    })
    s.addCard(b, 'todo', {
      x: 760,
      y: 40,
      content: { title: 'Action items', items: todoItems('Assign owner', 'Set due date') } as never,
    })
    s.addCard(b, 'comment', { x: 40, y: 330, content: { text: 'Key decision made here.' } as never })
    s.addCard(b, 'sticky', { x: 420, y: 330, content: { text: 'Parking lot / off-topic', color: 'purple' } as never })
  },
)

const goalTracker = buildTemplate(
  {
    id: 'builtin-goal-tracker',
    name: 'Goal Tracker',
    category: 'Planning',
    description: 'Objective, key results table, a progress chart and milestones — OKR-style tracking.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#c2542e', icon: 'todo' })
    s.addCard(b, 'heading', { x: 40, y: 40, content: { text: 'Objective', level: 1 } as never })
    s.addCard(b, 'note', {
      x: 40,
      y: 140,
      w: 340,
      content: { doc: noteDoc('## Why this matters', '') } as never,
    })
    s.addCard(b, 'table', {
      x: 420,
      y: 140,
      w: 420,
      content: {
        rows: [
          ['Key Result', 'Target', 'Current', 'Status'],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
        ],
      } as never,
    })
    s.addCard(b, 'chart', {
      x: 40,
      y: 440,
      w: 320,
      content: {
        chart: 'bar',
        title: 'Progress',
        rows: [
          ['Label', 'Value'],
          ['KR1', '40'],
          ['KR2', '65'],
          ['KR3', '20'],
        ],
      } as never,
    })
    s.addCard(b, 'todo', {
      x: 420,
      y: 440,
      content: {
        title: 'Milestones',
        items: todoItems('Define KRs', 'Mid-quarter check-in', 'Final review'),
      } as never,
    })
  },
)

// ---------- Data & decision-making ----------

const kpiDashboard = buildTemplate(
  {
    id: 'builtin-kpi-dashboard',
    name: 'KPI Dashboard',
    category: 'Data & decisions',
    description: 'Trend charts framed together, a KPI summary table and space for insights and follow-ups.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#1f6f6f', icon: 'template' })
    s.addCard(b, 'heading', { x: 40, y: 40, content: { text: 'KPI Dashboard', level: 1 } as never })
    s.addCard(b, 'frame', { x: 40, y: 140, w: 680, h: 320, content: { title: 'Trends' } as never })
    s.addCard(b, 'chart', {
      x: 60,
      y: 180,
      content: {
        chart: 'line',
        title: 'Revenue',
        rows: [
          ['Label', 'Value'],
          ['Jan', '12'],
          ['Feb', '18'],
          ['Mar', '15'],
          ['Apr', '22'],
        ],
      } as never,
    })
    s.addCard(b, 'chart', {
      x: 400,
      y: 180,
      content: {
        chart: 'bar',
        title: 'Signups',
        rows: [
          ['Label', 'Value'],
          ['Jan', '120'],
          ['Feb', '160'],
          ['Mar', '140'],
        ],
      } as never,
    })
    s.addCard(b, 'table', {
      x: 760,
      y: 140,
      w: 340,
      content: {
        rows: [
          ['KPI', 'Target', 'Actual'],
          ['', '', ''],
          ['', '', ''],
          ['', '', ''],
        ],
      } as never,
    })
    s.addCard(b, 'sticky', { x: 760, y: 440, content: { text: 'Insight: signups dipped in March', color: 'orange' } as never })
    s.addCard(b, 'todo', {
      x: 40,
      y: 500,
      content: { title: 'Follow-ups', items: todoItems('Investigate March dip', 'Share with team') } as never,
    })
  },
)

const decisionMatrix = buildTemplate(
  {
    id: 'builtin-decision-matrix',
    name: 'Decision Matrix',
    category: 'Data & decisions',
    description: 'Weighted-criteria scoring table plus pros/cons columns and a recommendation.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#9c3d54', icon: 'template' })
    s.addCard(b, 'heading', { x: 40, y: 40, content: { text: 'Decision: ___', level: 1 } as never })
    s.addCard(b, 'table', {
      x: 40,
      y: 140,
      w: 520,
      content: {
        rows: [
          ['Option', 'Cost (30%)', 'Quality (50%)', 'Speed (20%)', 'Score'],
          ['', '', '', '', ''],
          ['', '', '', '', ''],
          ['', '', '', '', ''],
        ],
      } as never,
    })
    const pros = s.addCard(b, 'column', { x: 600, y: 140, content: { title: 'Pros' } as never })
    const cons = s.addCard(b, 'column', { x: 900, y: 140, content: { title: 'Cons' } as never })
    const p = s.addCard(b, 'sticky', { x: 0, y: 0, content: { text: '', color: 'green' } as never })
    s.setCardColumn(p, pros, 0)
    const c = s.addCard(b, 'sticky', { x: 0, y: 0, content: { text: '', color: 'red' } as never })
    s.setCardColumn(c, cons, 0)
    s.addCard(b, 'note', {
      x: 40,
      y: 440,
      w: 420,
      content: { doc: noteDoc('## Recommendation', 'State the chosen option and why.') } as never,
    })
  },
)

const sprintRetro = buildTemplate(
  {
    id: 'builtin-sprint-retro',
    name: 'Sprint Retrospective',
    category: 'Data & decisions',
    description: 'Went well / didn’t go well / action items columns with ground rules.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#4c7a3d', icon: 'todo' })
    s.addCard(b, 'heading', { x: 40, y: 40, content: { text: 'Sprint Retro', level: 1 } as never })
    const well = s.addCard(b, 'column', { x: 40, y: 140, content: { title: 'Went well' } as never })
    const bad = s.addCard(b, 'column', { x: 360, y: 140, content: { title: "Didn't go well" } as never })
    const actions = s.addCard(b, 'column', { x: 680, y: 140, content: { title: 'Action items' } as never })
    const gw = s.addCard(b, 'sticky', { x: 0, y: 0, content: { text: '', color: 'green' } as never })
    s.setCardColumn(gw, well, 0)
    const gb = s.addCard(b, 'sticky', { x: 0, y: 0, content: { text: '', color: 'red' } as never })
    s.setCardColumn(gb, bad, 0)
    const at = s.addCard(b, 'todo', { x: 0, y: 0, content: { title: 'Actions', items: todoItems('Owner + due date') } as never })
    s.setCardColumn(at, actions, 0)
    s.addCard(b, 'note', {
      x: 40,
      y: 440,
      w: 400,
      content: { doc: noteDoc('## Ground rules', 'Blameless. Focus on systems, not people.') } as never,
    })
  },
)

// ---------- Life & personal ----------

const tripPlanner = buildTemplate(
  {
    id: 'builtin-trip-planner',
    name: 'Trip Planner',
    category: 'Life',
    description: 'Day-by-day itinerary, packing list, budget and booking links for a trip.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#2d8f7a', icon: 'image' })
    s.addCard(b, 'heading', { x: 40, y: 40, content: { text: 'Trip to ___', level: 1 } as never })
    s.addCard(b, 'table', {
      x: 40,
      y: 140,
      w: 460,
      content: {
        rows: [
          ['Day', 'Activity', 'Notes'],
          ['1', '', ''],
          ['2', '', ''],
          ['3', '', ''],
          ['4', '', ''],
        ],
      } as never,
    })
    s.addCard(b, 'todo', {
      x: 540,
      y: 140,
      content: { title: 'Packing list', items: todoItems('Passport', 'Chargers', 'Meds') } as never,
    })
    s.addCard(b, 'table', {
      x: 840,
      y: 140,
      w: 300,
      content: {
        rows: [
          ['Item', 'Budget'],
          ['Flights', ''],
          ['Hotel', ''],
          ['Food', ''],
        ],
      } as never,
    })
    s.addCard(b, 'link', { x: 40, y: 440, w: 280, content: { url: '', title: 'Flight confirmation', description: '' } as never })
    s.addCard(b, 'note', {
      x: 360,
      y: 440,
      w: 340,
      content: { doc: noteDoc('## Notes', 'Local emergency numbers, addresses, reservations.') } as never,
    })
  },
)

const eventPlanner = buildTemplate(
  {
    id: 'builtin-event-planner',
    name: 'Event Planner',
    category: 'Life',
    description: 'Checklist, guest list, budget table and a day-of timeline for planning an event.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#b0562f', icon: 'todo' })
    s.addCard(b, 'heading', { x: 40, y: 40, content: { text: 'Event: ___', level: 1 } as never })
    s.addCard(b, 'todo', {
      x: 40,
      y: 140,
      content: {
        title: 'Checklist',
        items: todoItems('Book venue', 'Confirm catering', 'Send invites', 'Order supplies'),
      } as never,
    })
    s.addCard(b, 'table', {
      x: 400,
      y: 140,
      w: 340,
      content: {
        rows: [
          ['Guest', 'RSVP'],
          ['', ''],
          ['', ''],
          ['', ''],
          ['', ''],
        ],
      } as never,
    })
    s.addCard(b, 'table', {
      x: 780,
      y: 140,
      w: 300,
      content: {
        rows: [
          ['Item', 'Budget', 'Actual'],
          ['', '', ''],
          ['', '', ''],
          ['', '', ''],
        ],
      } as never,
    })
    s.addCard(b, 'note', {
      x: 40,
      y: 440,
      w: 400,
      content: { doc: noteDoc('## Day-of timeline', 'Hour by hour schedule.') } as never,
    })
    s.addCard(b, 'sticky', { x: 480, y: 440, content: { text: 'Emergency contact: ___', color: 'yellow' } as never })
  },
)

const recipeCollection = buildTemplate(
  {
    id: 'builtin-recipe-collection',
    name: 'Recipe Collection',
    category: 'Life',
    description: 'Recipes sorted by meal type, a weekly meal plan table and a shopping list.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#c24e8a', icon: 'note' })
    s.addCard(b, 'heading', { x: 40, y: 40, content: { text: 'Recipe Box', level: 1 } as never })
    const breakfast = s.addCard(b, 'column', { x: 40, y: 140, content: { title: 'Breakfast' } as never })
    const dinner = s.addCard(b, 'column', { x: 340, y: 140, content: { title: 'Dinner' } as never })
    const dessert = s.addCard(b, 'column', { x: 640, y: 140, content: { title: 'Dessert' } as never })
    const n1 = s.addCard(b, 'note', { x: 0, y: 0, content: { doc: noteDoc('## Recipe name', 'Ingredients:', 'Steps:') } as never })
    s.setCardColumn(n1, breakfast, 0)
    const n2 = s.addCard(b, 'note', { x: 0, y: 0, content: { doc: noteDoc('## Recipe name', 'Ingredients:', 'Steps:') } as never })
    s.setCardColumn(n2, dinner, 0)
    const n3 = s.addCard(b, 'note', { x: 0, y: 0, content: { doc: noteDoc('## Recipe name', 'Ingredients:', 'Steps:') } as never })
    s.setCardColumn(n3, dessert, 0)
    s.addCard(b, 'table', {
      x: 960,
      y: 140,
      w: 320,
      content: {
        rows: [
          ['Day', 'Meal'],
          ['Mon', ''],
          ['Tue', ''],
          ['Wed', ''],
          ['Thu', ''],
          ['Fri', ''],
        ],
      } as never,
    })
    s.addCard(b, 'sticky', { x: 40, y: 460, content: { text: 'Shopping list', color: 'green' } as never })
  },
)

const readingList = buildTemplate(
  {
    id: 'builtin-reading-list',
    name: 'Reading List',
    category: 'Life',
    description: 'A tracked list of books with status and rating, plus what you’re reading now.',
  },
  (s, b) => {
    s.setBoardMeta(b, { color: '#5c4ea6', icon: 'note' })
    s.addCard(b, 'heading', { x: 40, y: 40, content: { text: 'Reading List', level: 1 } as never })
    s.addCard(b, 'table', {
      x: 40,
      y: 140,
      w: 480,
      content: {
        rows: [
          ['Book', 'Author', 'Status', 'Rating'],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
        ],
      } as never,
    })
    s.addCard(b, 'todo', {
      x: 560,
      y: 140,
      content: { title: 'Currently reading', items: todoItems('Finish chapter notes', 'Track pages/day') } as never,
    })
    s.addCard(b, 'sticky', { x: 560, y: 360, content: { text: 'Recommended by a friend', color: 'blue' } as never })
    s.addCard(b, 'note', {
      x: 40,
      y: 440,
      w: 400,
      content: { doc: noteDoc('## Favorite quote', 'Keep the best lines here.') } as never,
    })
  },
)

export const EXTRA_TEMPLATES: Template[] = [
  literatureReview,
  essayOutline,
  storyPlotBoard,
  weeklyPlanner,
  kanbanSprint,
  meetingNotesHub,
  goalTracker,
  kpiDashboard,
  decisionMatrix,
  sprintRetro,
  tripPlanner,
  eventPlanner,
  recipeCollection,
  readingList,
]
