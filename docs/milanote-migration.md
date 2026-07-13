# Migrating from Milanote

Milanote has no structured export (no JSON, no public API) — its export menu
offers PDF, PNG, Word, Markdown and plain text only. Folium supports two
migration paths.

## Path 1 — Markdown import (available now)

Best for: getting your content over quickly. Layout is not preserved
(Markdown is linear); images come across as links to Milanote's CDN, not as
embedded files.

1. In Milanote, open a board → Export → **Markdown** (repeat per board).
2. In Folium, either
   - drag the `.md` file(s) onto any board's canvas, or
   - Export menu → **Import Markdown… (Milanote)** and pick the files.
3. Each file becomes a new board (named from its `# Heading` or filename)
   containing typed cards: headings/paragraphs → notes (bold/italic/links
   preserved), checklists → to-do cards, pipe tables → table cards,
   `![images]` → image cards, standalone links → link cards, laid out in
   three balanced columns.

## Path 2 — Assisted full-fidelity migration (one-off, needs you present)

Best for: preserving spatial layout, colors, nesting and embedded images.

How it works: Milanote's web app fetches each board's full structure as JSON.
With your logged-in Chrome session connected (Claude-in-Chrome extension),
Claude opens your boards one by one, captures that JSON from the network
traffic, downloads the images through your session, converts everything into
a Folium backup file, and you import it via Export → Import backup.

To run it you need:
1. Chrome open on this machine with the **Claude in Chrome** extension
   connected.
2. Logged into your Milanote account.
3. Tell Claude "run the Milanote migration" and stay reachable — it will list
   your boards and confirm which to migrate before touching anything.

Notes:
- Read-only with respect to Milanote — nothing is modified or deleted there.
- The converter is written against Milanote's *internal* format at migration
  time; it is a one-off tool, not a maintained feature.
