import { noteDoc } from '../templates/builder'

/** The welcome note shown on a fresh Home board — also used to heal the
 *  AtlasNote-era seed note in pre-rebrand workspaces (see persist.ts). */
export function welcomeNoteDoc(): unknown {
  return noteDoc(
    '# Welcome to Folium 👋',
    'Your own loose-leaf workspace — notes, boards and sketches, all stored on this machine. No account, no cloud.',
    '',
    '## First steps',
    'Pick a tool on the left, then click the canvas. Double-click empty space for a quick note. Drag cards anywhere — drop one on a column to stack it.',
    'Right-click anything for more: colors, alignment, locking, snap-to-grid.',
  )
}

/** Distinctive sentence from the pre-rebrand seed note; if a note still
 *  contains it verbatim, the note is the untouched legacy seed. */
export const LEGACY_WELCOME_SNIPPET = 'Milanote-style board. Everything lives on this machine'
