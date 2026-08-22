import { type Editor, type TLShapeId } from 'tldraw'
import type { CanvasAction } from '../services/teacherAgentApi'
import { formulaSlot } from './mathLayoutEngine'
import { renderPrimitive } from './tldrawSceneRenderer'

type Context = { sessionId: string; stepId: number; actionIndex: number }
const elementIds = new Map<string, TLShapeId[]>()
const key = (sessionId: string, target: string) => `${sessionId}:${target}`

function readableMath(source: string) {
  return source.replace(/\$+/g, '').replace(/\\(?:Rightarrow|Longrightarrow|implies)\b/g, '⇒')
    .replace(/\\because\b/g, '∵').replace(/\\therefore\b/g, '∴').replace(/\\angle\s*/g, '∠')
    .replace(/\\triangle\s*/g, '△').replace(/\^\{?\\circ\}?/g, '°').replace(/\\circ\b/g, '°')
    .replace(/\\times\b/g, '×').replace(/\\div\b/g, '÷').replace(/\\leq?\b/g, '≤')
    .replace(/\\geq?\b/g, '≥').replace(/\\neq\b/g, '≠').replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)').replace(/\\text\{([^{}]+)\}/g, '$1')
    .replace(/\\(?:left|right)\b/g, '').replace(/[{}]/g, '').replace(/\\[,;! ]/g, ' ')
    .replace(/\\([a-zA-Z]+)/g, '$1').replace(/\s+/g, ' ').trim()
}

export function executeCanvasAction(editor: Editor, action: CanvasAction, ctx: Context) {
  const payload = action.payload || {}
  const semanticId = String(payload.id || payload.target || `step-${ctx.stepId}-action-${ctx.actionIndex}`)
  const remember = (ids: TLShapeId[]) => elementIds.set(key(ctx.sessionId, semanticId), ids)
  if (['DRAW_TRIANGLE', 'MARK_EQUAL', 'MARK_ANGLE'].includes(action.type)) return
  if (action.type === 'WRITE_LATEX') {
    const id = renderPrimitive(editor, ctx.sessionId, { kind: 'text', id: semanticId, at: formulaSlot(ctx.stepId, ctx.actionIndex), text: readableMath(String(payload.latex || '')), size: ctx.stepId >= 4 ? 'xl' : 'l', color: ctx.stepId >= 4 ? 'blue' : 'black', width: 600 })
    remember([id]); return
  }
  if (action.type === 'HIGHLIGHT') {
    const ids = elementIds.get(key(ctx.sessionId, String(payload.target || semanticId))) || []
    if (ids.length) editor.select(...ids)
    return
  }
  if (action.type === 'ERASE') {
    const ids = elementIds.get(key(ctx.sessionId, String(payload.target || semanticId))) || []
    if (ids.length) editor.deleteShapes(ids)
  }
}

export function clearAgentElements(sessionId: string) {
  for (const id of [...elementIds.keys()]) if (id.startsWith(`${sessionId}:`)) elementIds.delete(id)
}
