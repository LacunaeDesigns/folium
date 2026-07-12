import { registerCardBody } from './registry'
import { NoteCard } from './NoteCard'
import { TodoCard } from './TodoCard'
import { SwatchCard } from './SwatchCard'
import { ImageCard } from './ImageCard'
import { FileCard } from './FileCard'
import { LinkCard } from './LinkCard'
import './cards.css'

registerCardBody('note', NoteCard)
registerCardBody('todo', TodoCard)
registerCardBody('swatch', SwatchCard)
registerCardBody('image', ImageCard)
registerCardBody('file', FileCard)
registerCardBody('link', LinkCard)
