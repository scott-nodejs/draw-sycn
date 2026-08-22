import { createShapeId, getIndices, toRichText, type Editor, type TLShapeId } from 'tldraw'
import type { TeachingPlan } from '../services/teacherAgentApi'
import { layoutFigure, type Point, type ScenePrimitive } from './mathLayoutEngine'

const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 58)
const linePoints = (from: Point, to: Point) => {
  const [first, second] = getIndices(2)
  return { a1: { id: 'a1', index: first, x: 0, y: 0 }, a2: { id: 'a2', index: second, x: to.x - from.x, y: to.y - from.y } }
}

export function renderPrimitive(editor: Editor, ownerId: string, primitive: ScenePrimitive): TLShapeId {
  const id = createShapeId(safe(`${ownerId}-${primitive.id}`))
  if (editor.getShape(id)) return id
  if (primitive.kind === 'line') editor.createShape({ id, type: 'line', x: primitive.from.x, y: primitive.from.y, props: { points: linePoints(primitive.from, primitive.to), color: primitive.color || 'black', dash: primitive.dash || 'draw', size: primitive.size || 'm' } })
  if (primitive.kind === 'text') editor.createShape({ id, type: 'text', x: primitive.at.x, y: primitive.at.y, props: { richText: toRichText(primitive.text), color: primitive.color || 'black', size: primitive.size || 'l', font: 'sans', autoSize: primitive.width == null, w: primitive.width || 620, textAlign: 'start' } })
  if (primitive.kind === 'ellipse') editor.createShape({ id, type: 'geo', x: primitive.at.x, y: primitive.at.y, props: { geo: 'ellipse', w: primitive.width, h: primitive.height, color: primitive.color || 'black' } })
  return id
}

export function renderTeachingScene(editor: Editor, ownerId: string, plan: TeachingPlan) {
  const ids = layoutFigure(plan.figure).map(primitive => renderPrimitive(editor, ownerId, primitive))
  if (plan.sceneType === 'geometry') editor.zoomToBounds({ x: 0, y: 40, w: 1600, h: 820 }, { animation: { duration: 250 }, inset: 20 })
  return ids
}
