import type { Pt } from "./geometry";

export type ObjKind = "point" | "segment" | "line" | "circle";

export interface BaseObj { id: string; kind: ObjKind; label?: string; construction?: boolean }
export interface PointObj extends BaseObj { kind: "point"; x: number; y: number }
export interface SegmentObj extends BaseObj { kind: "segment"; a: string; b: string }
export interface LineObj extends BaseObj { kind: "line"; a: string; b: string }
export interface CircleObj extends BaseObj { kind: "circle"; centre: string; through?: string; radius?: number }

export type GeoObj = PointObj | SegmentObj | LineObj | CircleObj;

export interface State {
  objects: GeoObj[];
  nextLabel: number;
}

export function emptyState(): State {
  return { objects: [], nextLabel: 0 };
}

export function cloneState(s: State): State {
  return { objects: s.objects.map((o) => ({ ...o })), nextLabel: s.nextLabel };
}

export function nextPointLabel(s: State): string {
  const label = indexToLabel(s.nextLabel);
  s.nextLabel++;
  return label;
}

function indexToLabel(i: number): string {
  // A..Z, A1..Z1, A2..Z2
  const suffix = Math.floor(i / 26);
  const base = String.fromCharCode(65 + (i % 26));
  return suffix === 0 ? base : `${base}${suffix}`;
}

export function getPoint(s: State, id: string): PointObj | undefined {
  return s.objects.find((o) => o.id === id && o.kind === "point") as PointObj | undefined;
}

export function getPt(s: State, id: string): Pt | null {
  const p = getPoint(s, id);
  return p ? { x: p.x, y: p.y } : null;
}

let idCounter = 1;
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;
}
