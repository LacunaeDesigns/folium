import { registerCardBody } from './registry'
import { NoteCard } from './NoteCard'
import { TodoCard } from './TodoCard'
import { SwatchCard } from './SwatchCard'
import { ImageCard } from './ImageCard'
import { FileCard } from './FileCard'
import { LinkCard } from './LinkCard'
import { BoardCard } from './BoardCard'
import { ColumnCard } from './ColumnCard'
import { CommentCard } from './CommentCard'
import { TableCard } from './TableCard'
import './cards.css'

registerCardBody('note', NoteCard)
registerCardBody('todo', TodoCard)
registerCardBody('swatch', SwatchCard)
registerCardBody('image', ImageCard)
registerCardBody('file', FileCard)
registerCardBody('link', LinkCard)
registerCardBody('board', BoardCard)
registerCardBody('column', ColumnCard)
registerCardBody('comment', CommentCard)
registerCardBody('table', TableCard)
