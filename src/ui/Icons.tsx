import React from 'react'

export type IconName =
  | 'note'
  | 'link'
  | 'todo'
  | 'line'
  | 'board'
  | 'column'
  | 'comment'
  | 'table'
  | 'chart'
  | 'dots'
  | 'image'
  | 'upload'
  | 'draw'
  | 'trash'
  | 'search'
  | 'settings'
  | 'close'
  | 'plus'
  | 'chevron-down'
  | 'chevron-right'
  | 'back'
  | 'export'
  | 'swatch'
  | 'sticky'
  | 'shape'
  | 'play'
  | 'download'
  | 'restore'
  | 'check'
  | 'edit'
  | 'duplicate'
  | 'palette'
  | 'template'
  | 'broadcast'
  | 'home'
  | 'reply'
  | 'pin'
  | 'zoom-in'
  | 'zoom-out'
  | 'fit'
  | 'eraser'
  | 'frame'
  | 'heading'
  | 'help'
  | 'undo'
  | 'redo'

const paths: Record<IconName, React.ReactNode> = {
  note: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="14" y2="18" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5" />
    </>
  ),
  todo: (
    <>
      <rect x="3.5" y="4" width="6" height="6" rx="1.5" />
      <path d="m5.5 7 1.4 1.4L9.5 5.8" />
      <line x1="13" y1="7" x2="20.5" y2="7" />
      <rect x="3.5" y="14" width="6" height="6" rx="1.5" />
      <line x1="13" y1="17" x2="20.5" y2="17" />
    </>
  ),
  line: (
    <>
      <line x1="5" y1="19" x2="19" y2="5" />
      <path d="M12 5h7v7" />
    </>
  ),
  board: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <rect x="7.5" y="7.5" width="3.6" height="3.6" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="13" y="7.5" width="3.6" height="3.6" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="7.5" y="13" width="3.6" height="3.6" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="13" y="13" width="3.6" height="3.6" rx="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  column: (
    <>
      <rect x="6" y="3.5" width="12" height="17" rx="2" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </>
  ),
  comment: (
    <>
      <path d="M4 6a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 14Z" />
      <line x1="8" y1="8.5" x2="16" y2="8.5" />
      <line x1="8" y1="12" x2="13" y2="12" />
    </>
  ),
  table: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
      <line x1="3.5" y1="14.5" x2="20.5" y2="14.5" />
      <line x1="11" y1="4.5" x2="11" y2="19.5" />
    </>
  ),
  chart: (
    <>
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="5.5" y="11" width="3.2" height="7" rx="0.5" />
      <rect x="10.4" y="7" width="3.2" height="11" rx="0.5" />
      <rect x="15.3" y="13" width="3.2" height="5" rx="0.5" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m3.5 17 5-4.5 4 3.5 3.5-3 4.5 4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V5" />
      <path d="m7 9.5 5-5 5 5" />
      <path d="M4.5 16.5V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1.5" />
    </>
  ),
  draw: (
    <>
      <path d="m14.5 5.5 4 4L8 20l-4.6.6L4 16Z" />
      <path d="m13 7 4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14" />
      <path d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
      <path d="M6.5 7.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-11.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
    </>
  ),
  close: (
    <>
      <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
      <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="4.5" x2="12" y2="19.5" />
      <line x1="4.5" y1="12" x2="19.5" y2="12" />
    </>
  ),
  'chevron-down': <path d="m6 9.5 6 6 6-6" />,
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
  back: <path d="M15.5 5 9 12l6.5 7" />,
  export: (
    <>
      <path d="M12 4v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  swatch: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M4 13.5h16" />
    </>
  ),
  sticky: (
    <>
      <path d="M4.5 4.5h15v9l-6 6h-9Z" />
      <path d="M13.5 19.5v-6h6" />
    </>
  ),
  shape: (
    <>
      <circle cx="8.2" cy="15.2" r="4.7" />
      <rect x="11.5" y="4" width="8.5" height="8.5" rx="1.5" />
    </>
  ),
  play: <path d="M7 4.8v14.4L19 12Z" />,
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  restore: (
    <>
      <path d="M4.5 6.5v5h5" />
      <path d="M5.5 11.5a7 7 0 1 0 2-6" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  edit: (
    <>
      <path d="m14.5 5.5 4 4L8 20l-4.6.6L4 16Z" />
    </>
  ),
  duplicate: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 4.5H6.5a2 2 0 0 0-2 2V16" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.8 2-1.7 0-.8-.6-1.3-.6-2.1 0-1 .8-1.7 1.9-1.7h2A3.2 3.2 0 0 0 20.5 12 8.5 8.5 0 0 0 12 3.5Z" />
      <circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  template: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M3.5 9h17M9.5 9v11.5" />
    </>
  ),
  broadcast: (
    <>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M6 18a8.5 8.5 0 0 1 0-12M18 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  home: (
    <>
      <path d="m4 11 8-7 8 7" />
      <path d="M6.5 9.5V20h11V9.5" />
    </>
  ),
  reply: (
    <>
      <path d="M9.5 5 4 10.5 9.5 16" />
      <path d="M4.5 10.5H14a6 6 0 0 1 6 6V19" />
    </>
  ),
  pin: (
    <>
      <circle cx="12" cy="10" r="6.5" />
      <path d="M12 16.5V21" />
    </>
  ),
  'zoom-in': (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" />
      <path d="M10.5 7.8v5.4M7.8 10.5h5.4" />
    </>
  ),
  'zoom-out': (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" />
      <path d="M7.8 10.5h5.4" />
    </>
  ),
  fit: (
    <>
      <path d="M8.5 3.5H5a1.5 1.5 0 0 0-1.5 1.5v3.5M15.5 3.5H19a1.5 1.5 0 0 1 1.5 1.5v3.5M8.5 20.5H5A1.5 1.5 0 0 1 3.5 19v-3.5M15.5 20.5H19a1.5 1.5 0 0 0 1.5-1.5v-3.5" />
    </>
  ),
  eraser: (
    <>
      <path d="m5 15 8.5-8.5a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 18H8Z" />
      <path d="M5 18h14" transform="translate(0 2)" />
    </>
  ),
  frame: (
    <>
      <path d="M4 9V4h5" />
      <path d="M15 4h5v5" />
      <path d="M20 15v5h-5" />
      <path d="M9 20H4v-5" />
    </>
  ),
  heading: (
    <>
      <path d="M5 4.5v15" />
      <path d="M19 4.5v15" />
      <path d="M5 12h14" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.3 9.5a2.7 2.7 0 0 1 5.3.7c0 1.8-2.4 2-2.4 3.6" />
      <circle cx="12" cy="16.7" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  undo: (
    <>
      <path d="M7 8H4.5V5.5" />
      <path d="M4.7 8a7.5 7.5 0 1 1-1.7 5" />
    </>
  ),
  redo: (
    <>
      <path d="M17 8h2.5V5.5" />
      <path d="M19.3 8a7.5 7.5 0 1 0 1.7 5" />
    </>
  ),
}

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.6,
  className,
}: {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  )
}
