import React from 'react'
import { CardBodyProps } from './registry'
import { FileContent } from '../model/types'
import { useBlobUrl } from './blobUrl'
import { Icon } from '../ui/Icons'

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toUpperCase() : 'FILE'
}

export function FileCard({ card }: CardBodyProps) {
  const content = card.content as FileContent
  const blobUrl = useBlobUrl(content.blobId)
  const ext = extOf(content.name)

  const isAudio = content.mime.startsWith('audio/')
  const isVideo = content.mime.startsWith('video/')

  return (
    <div className="file-card">
      {isVideo && blobUrl ? (
        <video className="file-media no-drag" src={blobUrl} controls preload="metadata" />
      ) : null}
      {isAudio && blobUrl ? <audio className="file-audio no-drag" src={blobUrl} controls preload="metadata" /> : null}
      <div className="file-row">
        <div className="file-badge" data-ext={ext.toLowerCase()}>
          {ext.slice(0, 4)}
        </div>
        <div className="file-meta">
          <div className="file-name">{content.name || 'Untitled file'}</div>
          <div className="file-sub">
            {blobUrl ? (
              <a className="file-download no-drag" href={blobUrl} download={content.name}>
                Download
              </a>
            ) : (
              <span>—</span>
            )}
            {' · '}
            {formatSize(content.size)}
          </div>
        </div>
      </div>
    </div>
  )
}
