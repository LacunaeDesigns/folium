# Importing Markdown files

Folium can turn Markdown files into boards, so you can bring content over from
any tool that exports Markdown (or from plain notes you already have).

## How to import

1. Get your content as `.md` files — most note and board tools have a
   **Markdown** export; one file per board works best.
2. In Folium, either:
   - drag the `.md` file(s) onto any board's canvas, or
   - **Export menu → Import Markdown files** and pick them.
3. Each file becomes a new board (named from its first `# Heading`, or the
   filename) containing typed cards:
   - headings / paragraphs → notes (bold, italic and links preserved)
   - checklists (`- [ ]`) → to-do cards
   - pipe tables → table cards
   - `![images]` → image cards (linked by URL)
   - standalone links → link cards

   Cards are laid out in three balanced columns.

## What doesn't come across

Markdown is a linear text format, so it can't carry a board's spatial layout,
colors, or embedded (uploaded) images — those arrive as links if the source
kept them as URLs. For moving a full Folium workspace between your own machines
with everything intact, use **Export → Back up all data (JSON)** and **Import
backup**, or turn on cross-machine folder sync (see the README).
