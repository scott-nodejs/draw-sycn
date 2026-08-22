import type { FigureSpec } from '../services/teacherAgentApi'

export type Point = { x: number; y: number }
export type CanvasColor = 'black' | 'blue' | 'green' | 'grey' | 'orange' | 'red' | 'violet' | 'white' | 'yellow'
export type ScenePrimitive =
  | { kind: 'line'; id: string; from: Point; to: Point; color?: CanvasColor; dash?: 'draw' | 'solid'; size?: 's' | 'm' }
  | { kind: 'text'; id: string; at: Point; text: string; color?: CanvasColor; size?: 's' | 'm' | 'l' | 'xl'; width?: number }
  | { kind: 'ellipse'; id: string; at: Point; width: number; height: number; color?: CanvasColor }

export const BOARD = {
  width: 1600,
  height: 900,
  figure: { left: 70, top: 100, width: 750, height: 700 },
  derivation: { left: 900, top: 125, width: 610, lineHeight: 95 },
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const segmentEnds = (segment: string, points: Map<string, Point>) => {
  const names = [...segment]
  return names.length >= 2 ? [points.get(names[0]), points.get(names[1])] as const : [undefined, undefined] as const
}

function tick(id: string, a: Point, b: Point): ScenePrimitive {
  const m = midpoint(a, b)
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const nx = -(b.y - a.y) / length
  const ny = (b.x - a.x) / length
  return { kind: 'line', id, from: { x: m.x - nx * 10, y: m.y - ny * 10 }, to: { x: m.x + nx * 10, y: m.y + ny * 10 }, color: 'blue', size: 'm' }
}

export function layoutFigure(figure?: FigureSpec): ScenePrimitive[] {
  if (!figure || figure.points.length < 3) return []
  const labels = figure.points.slice(0, 3)
  const apex = figure.apex || labels[0]
  const base = labels.filter(label => label !== apex)
  const coords = new Map<string, Point>([
    [apex, { x: 445, y: 165 }],
    [base[0], { x: 165, y: 650 }],
    [base[1], { x: 725, y: 650 }],
  ])
  const result: ScenePrimitive[] = []
  for (let index = 0; index < labels.length; index++) {
    const from = coords.get(labels[index])!
    const to = coords.get(labels[(index + 1) % labels.length])!
    result.push({ kind: 'line', id: `figure-edge-${labels[index]}${labels[(index + 1) % labels.length]}`, from, to, size: 'm' })
  }
  for (const label of labels) {
    const p = coords.get(label)!
    const y = label === apex ? p.y - 48 : p.y + 18
    result.push({ kind: 'text', id: `figure-label-${label}`, at: { x: p.x - 13, y }, text: label, size: 'l' })
  }
  for (const [constraintIndex, constraint] of (figure.constraints || []).entries()) {
    if (constraint.type.toLowerCase() === 'equal_length') {
      for (const [segmentIndex, segment] of (constraint.segments || []).entries()) {
        const [a, b] = segmentEnds(segment, coords)
        if (a && b) result.push(tick(`constraint-${constraintIndex}-equal-${segmentIndex}`, a, b))
      }
    }
    if (constraint.type.toLowerCase() === 'midpoint' && constraint.point && constraint.points?.length === 2) {
      const a = coords.get(constraint.points[0]); const b = coords.get(constraint.points[1])
      if (a && b) coords.set(constraint.point, midpoint(a, b))
    }
  }
  for (const [index, annotation] of (figure.annotations || []).entries()) {
    if (annotation.type.toLowerCase() === 'angle' && annotation.vertex) {
      const p = coords.get(annotation.vertex)
      if (p) result.push({ kind: 'text', id: `annotation-angle-${index}`, at: { x: p.x + 24, y: p.y + 52 }, text: annotation.value || annotation.label || '', color: 'blue', size: 'm' })
    }
  }
  return result
}

export function formulaSlot(stepId: number, actionIndex: number): Point {
  return { x: BOARD.derivation.left, y: BOARD.derivation.top + (Math.max(stepId, 1) - 1) * BOARD.derivation.lineHeight + actionIndex * 48 }
}
