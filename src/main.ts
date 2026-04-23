import "./styles.css";
import {
  angleBisectorLine,
  circleCircleIntersect,
  dist,
  lineCircleIntersect,
  lineLineIntersect,
  midpoint,
  perpendicularBisectorLine,
  type Pt,
} from "./geometry";
import {
  cloneState,
  emptyState,
  getPt,
  newId,
  type CircleObj,
  type GeoObj,
  type LineObj,
  type PointObj,
  type SegmentObj,
  type State,
} from "./store";
import { TEMPLATES } from "./templates";

type Tool =
  | "select"
  | "point"
  | "segment"
  | "line"
  | "circle"
  | "intersect"
  | "midpoint"
  | "perp_bis"
  | "ang_bis";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const hud = document.getElementById("hud")!;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const tplDialog = document.getElementById("tpl-dialog") as HTMLDialogElement;
const tplGrid = document.getElementById("tpl-grid")!;

// ---------- view + state ----------
const view = { x: 0, y: 0, zoom: 1 };
const SNAP_PX = 12;

let state: State = emptyState();
let history: State[] = [];
let future: State[] = [];
let activeTool: Tool = "select";
let pending: string[] = []; // ids chosen during multi-click tools
let hoverId: string | null = null;
let selectedId: string | null = null;
let dragging: { id: string; offsetX: number; offsetY: number } | null = null;
let panning: { sx: number; sy: number; vx: number; vy: number } | null = null;
let mouseWorld: Pt = { x: 0, y: 0 };
let pointerDown = false;

// ---------- helpers ----------
function pushHistory() {
  history.push(cloneState(state));
  if (history.length > 80) history.shift();
  future = [];
}

function applyState(newState: State) {
  pushHistory();
  state = newState;
  pending = [];
  selectedId = null;
  render();
}

function undo() {
  const prev = history.pop();
  if (!prev) return;
  future.push(cloneState(state));
  state = prev;
  pending = [];
  render();
}

function redo() {
  const next = future.pop();
  if (!next) return;
  history.push(cloneState(state));
  state = next;
  pending = [];
  render();
}

function setTool(t: Tool) {
  activeTool = t;
  pending = [];
  document.querySelectorAll<HTMLButtonElement>(".tool[data-tool]").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.tool === t);
  });
  updateHud();
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

function screenToWorld(sx: number, sy: number): Pt {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (sx - rect.left) / view.zoom + view.x,
    y: (sy - rect.top) / view.zoom + view.y,
  };
}

function worldToScreen(p: Pt): Pt {
  return { x: (p.x - view.x) * view.zoom, y: (p.y - view.y) * view.zoom };
}

function nextLabel(s: State): string {
  const label = idxLabel(s.nextLabel);
  s.nextLabel++;
  return label;
}
function idxLabel(i: number): string {
  const suffix = Math.floor(i / 26);
  const base = String.fromCharCode(65 + (i % 26));
  return suffix === 0 ? base : `${base}${suffix}`;
}

// ---------- hit testing ----------
function nearestPoint(p: Pt, maxDistPx: number): string | null {
  let best: { id: string; d: number } | null = null;
  for (const o of state.objects) {
    if (o.kind !== "point") continue;
    const d = dist(p, o);
    if (d * view.zoom <= maxDistPx && (!best || d < best.d)) {
      best = { id: o.id, d };
    }
  }
  return best?.id ?? null;
}

function objectsUnder(p: Pt, maxDistPx: number): string[] {
  const hits: string[] = [];
  for (const o of state.objects) {
    if (o.kind === "point") continue;
    if (hitTest(o, p, maxDistPx / view.zoom)) hits.push(o.id);
  }
  return hits;
}

function hitTest(o: GeoObj, p: Pt, tol: number): boolean {
  if (o.kind === "segment") {
    const a = getPt(state, o.a);
    const b = getPt(state, o.b);
    if (!a || !b) return false;
    return distToSegment(p, a, b) <= tol;
  }
  if (o.kind === "line") {
    const a = getPt(state, o.a);
    const b = getPt(state, o.b);
    if (!a || !b) return false;
    return distToLine(p, a, b) <= tol;
  }
  if (o.kind === "circle") {
    const c = getPt(state, o.centre);
    if (!c) return false;
    const r = circleRadius(o);
    if (!isFinite(r)) return false;
    return Math.abs(dist(p, c) - r) <= tol;
  }
  return false;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function distToLine(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return dist(p, a);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function circleRadius(o: CircleObj): number {
  if (o.radius) return o.radius;
  const c = getPt(state, o.centre);
  if (!c || !o.through) return NaN;
  const t = getPt(state, o.through);
  if (!t) return NaN;
  return dist(c, t);
}

// ---------- tool actions ----------
function handleClick(worldPt: Pt, screenPt: Pt) {
  if (activeTool === "select") return;
  const snappedId = nearestPoint(worldPt, SNAP_PX);
  const snapped = snappedId ? (state.objects.find((o) => o.id === snappedId) as PointObj) : null;
  const clickPt = snapped ? { x: snapped.x, y: snapped.y } : worldPt;

  if (activeTool === "point") {
    const s = cloneState(state);
    if (!snappedId) {
      const id = newId("p");
      s.objects.push({ id, kind: "point", x: clickPt.x, y: clickPt.y, label: nextLabel(s) });
    }
    applyState(s);
    return;
  }

  if (activeTool === "segment" || activeTool === "line") {
    const pid = ensurePointAt(clickPt, snappedId);
    pending.push(pid);
    if (pending.length === 2) {
      const s = cloneState(state);
      if (activeTool === "segment") {
        s.objects.push({ id: newId("s"), kind: "segment", a: pending[0], b: pending[1] });
      } else {
        s.objects.push({ id: newId("l"), kind: "line", a: pending[0], b: pending[1] });
      }
      pending = [];
      applyState(s);
    } else {
      render();
      updateHud();
    }
    return;
  }

  if (activeTool === "circle") {
    const pid = ensurePointAt(clickPt, snappedId);
    pending.push(pid);
    if (pending.length === 2) {
      const s = cloneState(state);
      s.objects.push({ id: newId("c"), kind: "circle", centre: pending[0], through: pending[1] });
      pending = [];
      applyState(s);
    } else {
      render();
      updateHud();
    }
    return;
  }

  if (activeTool === "intersect") {
    const hits = objectsUnder(worldPt, SNAP_PX);
    if (hits.length === 0) return;
    pending.push(hits[0]);
    if (pending.length === 2) {
      const intersections = computeIntersections(pending[0], pending[1]);
      const s = cloneState(state);
      for (const p of intersections) {
        const id = newId("p");
        s.objects.push({ id, kind: "point", x: p.x, y: p.y, label: nextLabel(s) });
      }
      pending = [];
      applyState(s);
    } else {
      render();
      updateHud();
    }
    return;
  }

  if (activeTool === "midpoint") {
    const hits = objectsUnder(worldPt, SNAP_PX);
    if (!hits.length) return;
    const obj = state.objects.find((o) => o.id === hits[0])!;
    if (obj.kind !== "segment") return;
    const a = getPt(state, obj.a);
    const b = getPt(state, obj.b);
    if (!a || !b) return;
    const m = midpoint(a, b);
    const s = cloneState(state);
    s.objects.push({ id: newId("p"), kind: "point", x: m.x, y: m.y, label: nextLabel(s) });
    applyState(s);
    return;
  }

  if (activeTool === "perp_bis") {
    const hits = objectsUnder(worldPt, SNAP_PX);
    if (!hits.length) return;
    const obj = state.objects.find((o) => o.id === hits[0])!;
    if (obj.kind !== "segment") return;
    const a = getPt(state, obj.a);
    const b = getPt(state, obj.b);
    if (!a || !b) return;
    const line = perpendicularBisectorLine(a, b);
    const s = cloneState(state);
    const p1 = newId("p");
    const p2 = newId("p");
    s.objects.push({ id: p1, kind: "point", x: line.p1.x, y: line.p1.y, construction: true });
    s.objects.push({ id: p2, kind: "point", x: line.p2.x, y: line.p2.y, construction: true });
    s.objects.push({ id: newId("l"), kind: "line", a: p1, b: p2 });
    applyState(s);
    return;
  }

  if (activeTool === "ang_bis") {
    if (!snappedId) return;
    pending.push(snappedId);
    if (pending.length === 3) {
      // pending order: first click, second click (VERTEX), third click.
      // Actually convention: click B, A (vertex), C.
      const b = getPt(state, pending[0])!;
      const a = getPt(state, pending[1])!;
      const c = getPt(state, pending[2])!;
      const line = angleBisectorLine(a, b, c);
      const s = cloneState(state);
      const p2 = newId("p");
      s.objects.push({ id: p2, kind: "point", x: line.p2.x, y: line.p2.y, construction: true });
      s.objects.push({ id: newId("l"), kind: "line", a: pending[1], b: p2 });
      pending = [];
      applyState(s);
    } else {
      render();
      updateHud();
    }
    screenPt; // unused
    return;
  }
}

function ensurePointAt(p: Pt, existing: string | null): string {
  if (existing) return existing;
  const s = cloneState(state);
  const id = newId("p");
  s.objects.push({ id, kind: "point", x: p.x, y: p.y, label: nextLabel(s) });
  pushHistory();
  state = s;
  return id;
}

function computeIntersections(aid: string, bid: string): Pt[] {
  const A = state.objects.find((o) => o.id === aid)!;
  const B = state.objects.find((o) => o.id === bid)!;

  const asLinePts = (o: GeoObj): { a: Pt; b: Pt; isSegment: boolean } | null => {
    if (o.kind === "segment" || o.kind === "line") {
      const a = getPt(state, (o as SegmentObj).a);
      const b = getPt(state, (o as SegmentObj).b);
      if (a && b) return { a, b, isSegment: o.kind === "segment" };
    }
    return null;
  };

  const asCircle = (o: GeoObj): { centre: Pt; r: number } | null => {
    if (o.kind !== "circle") return null;
    const c = getPt(state, (o as CircleObj).centre);
    if (!c) return null;
    const r = circleRadius(o as CircleObj);
    if (!isFinite(r)) return null;
    return { centre: c, r };
  };

  const AL = asLinePts(A);
  const BL = asLinePts(B);
  const AC = asCircle(A);
  const BC = asCircle(B);

  if (AL && BL) {
    const p = lineLineIntersect(AL.a, AL.b, BL.a, BL.b, AL.isSegment, BL.isSegment);
    return p ? [p] : [];
  }
  if (AL && BC) return lineCircleIntersect(AL.a, AL.b, BC.centre, BC.r, AL.isSegment);
  if (BL && AC) return lineCircleIntersect(BL.a, BL.b, AC.centre, AC.r, BL.isSegment);
  if (AC && BC) return circleCircleIntersect(AC.centre, AC.r, BC.centre, BC.r);
  return [];
}

// ---------- rendering ----------
function render() {
  const rect = canvas.getBoundingClientRect();
  ctx.save();
  ctx.fillStyle = "#fbfaf7";
  ctx.fillRect(0, 0, rect.width, rect.height);

  drawGrid(rect.width, rect.height);

  ctx.save();
  ctx.translate(-view.x * view.zoom, -view.y * view.zoom);
  ctx.scale(view.zoom, view.zoom);

  // Circles first, then lines, then segments, then points on top
  for (const o of state.objects) if (o.kind === "circle") drawCircle(o);
  for (const o of state.objects) if (o.kind === "line") drawLine(o, rect.width, rect.height);
  for (const o of state.objects) if (o.kind === "segment") drawSegment(o);
  for (const o of state.objects) if (o.kind === "point") drawPoint(o);

  ctx.restore();

  // Pending highlight (screen-space markers)
  if (pending.length > 0) drawPendingHints();

  ctx.restore();
}

function drawGrid(w: number, h: number) {
  const step = 40 * view.zoom;
  const startX = -((view.x * view.zoom) % step);
  const startY = -((view.y * view.zoom) % step);
  ctx.save();
  ctx.strokeStyle = "#ebe8e0";
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  for (let x = startX; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = startY; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPoint(o: PointObj) {
  const hovered = hoverId === o.id;
  const selected = selectedId === o.id;
  const r = (hovered || selected ? 5 : 3.8) / view.zoom;
  ctx.save();
  ctx.beginPath();
  ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
  ctx.fillStyle = selected || hovered ? "#00c853" : o.construction ? "#999" : "#111";
  ctx.fill();
  if (selected || hovered) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5 / view.zoom;
    ctx.stroke();
  }
  if (o.label) {
    ctx.fillStyle = "#00695c";
    ctx.font = `500 ${12 / view.zoom}px "JetBrains Mono", monospace`;
    ctx.fillText(o.label, o.x + 7 / view.zoom, o.y - 6 / view.zoom);
  }
  ctx.restore();
}

function drawSegment(o: SegmentObj) {
  const a = getPt(state, o.a);
  const b = getPt(state, o.b);
  if (!a || !b) return;
  const hovered = hoverId === o.id;
  const selected = selectedId === o.id;
  ctx.save();
  ctx.strokeStyle = selected || hovered ? "#00c853" : "#111";
  ctx.lineWidth = (selected || hovered ? 2 : 1.4) / view.zoom;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawLine(o: LineObj, vw: number, vh: number) {
  const a = getPt(state, o.a);
  const b = getPt(state, o.b);
  if (!a || !b) return;
  const tMin = -10_000, tMax = 10_000;
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return;
  const p1 = { x: a.x + dx * tMin, y: a.y + dy * tMin };
  const p2 = { x: a.x + dx * tMax, y: a.y + dy * tMax };
  const hovered = hoverId === o.id;
  const selected = selectedId === o.id;
  ctx.save();
  ctx.strokeStyle = selected || hovered ? "#00c853" : "#111";
  ctx.lineWidth = (selected || hovered ? 1.6 : 1) / view.zoom;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.restore();
  void vw;
  void vh;
}

function drawCircle(o: CircleObj) {
  const c = getPt(state, o.centre);
  if (!c) return;
  const r = circleRadius(o);
  if (!isFinite(r) || r <= 0) return;
  const hovered = hoverId === o.id;
  const selected = selectedId === o.id;
  ctx.save();
  ctx.strokeStyle = selected || hovered ? "#00c853" : o.construction ? "#aaa" : "#111";
  ctx.setLineDash(o.construction ? [4 / view.zoom, 4 / view.zoom] : []);
  ctx.lineWidth = (selected || hovered ? 1.8 : 1.2) / view.zoom;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPendingHints() {
  for (const id of pending) {
    const o = state.objects.find((x) => x.id === id);
    if (!o) continue;
    if (o.kind === "point") {
      const sp = worldToScreen({ x: o.x, y: o.y });
      ctx.save();
      ctx.strokeStyle = "#00c853";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ---------- input ----------
// Track active pointers for two-finger pan + pinch (mobile).
const activePointers = new Map<number, { x: number; y: number }>();
let pinchStart: { dist: number; mid: Pt; vx: number; vy: number; zoom: number } | null = null;

function pinchDistance(): { d: number; mid: Pt } {
  const pts = Array.from(activePointers.values());
  const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
  return {
    d: Math.hypot(dx, dy),
    mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
  };
}

function onPointerDown(e: PointerEvent) {
  canvas.setPointerCapture(e.pointerId);
  pointerDown = true;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const world = screenToWorld(e.clientX, e.clientY);
  mouseWorld = world;

  if (activePointers.size >= 2) {
    const { d, mid } = pinchDistance();
    pinchStart = { dist: d, mid, vx: view.x, vy: view.y, zoom: view.zoom };
    dragging = null;
    panning = null;
    return;
  }

  if (e.button === 2 || e.shiftKey) {
    panning = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    return;
  }

  if (activeTool === "select") {
    const pid = nearestPoint(world, SNAP_PX);
    if (pid) {
      const p = state.objects.find((o) => o.id === pid) as PointObj;
      selectedId = pid;
      dragging = { id: pid, offsetX: world.x - p.x, offsetY: world.y - p.y };
      pushHistory();
      render();
      return;
    }
    selectedId = null;
    render();
    return;
  }

  handleClick(world, { x: e.clientX, y: e.clientY });
}

function onPointerMove(e: PointerEvent) {
  if (activePointers.has(e.pointerId)) {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  const world = screenToWorld(e.clientX, e.clientY);
  mouseWorld = world;

  if (pinchStart && activePointers.size >= 2) {
    const { d, mid } = pinchDistance();
    const zoomFactor = d / pinchStart.dist;
    const newZoom = Math.min(5, Math.max(0.2, pinchStart.zoom * zoomFactor));
    const rect = canvas.getBoundingClientRect();
    const cx = mid.x - rect.left;
    const cy = mid.y - rect.top;
    const dx = (mid.x - pinchStart.mid.x) / pinchStart.zoom;
    const dy = (mid.y - pinchStart.mid.y) / pinchStart.zoom;
    view.x = pinchStart.vx - dx + cx / pinchStart.zoom - cx / newZoom;
    view.y = pinchStart.vy - dy + cy / pinchStart.zoom - cy / newZoom;
    view.zoom = newZoom;
    render();
    return;
  }

  if (panning) {
    const dx = (e.clientX - panning.sx) / view.zoom;
    const dy = (e.clientY - panning.sy) / view.zoom;
    view.x = panning.vx - dx;
    view.y = panning.vy - dy;
    render();
    return;
  }

  if (dragging) {
    const p = state.objects.find((o) => o.id === dragging!.id) as PointObj;
    if (p) {
      p.x = world.x - dragging.offsetX;
      p.y = world.y - dragging.offsetY;
      render();
    }
    return;
  }

  const npid = nearestPoint(world, SNAP_PX);
  const oldHover = hoverId;
  if (npid) {
    hoverId = npid;
  } else {
    const hits = objectsUnder(world, SNAP_PX);
    hoverId = hits[0] ?? null;
  }
  if (oldHover !== hoverId) {
    render();
    updateHud();
  }
  void pointerDown;
}

function onPointerUp(e: PointerEvent) {
  canvas.releasePointerCapture(e.pointerId);
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) pinchStart = null;
  pointerDown = false;
  panning = null;
  dragging = null;
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const prev = view.zoom;
  const factor = Math.exp(-e.deltaY * 0.0015);
  const nz = Math.min(5, Math.max(0.2, prev * factor));
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  view.x += cx / prev - cx / nz;
  view.y += cy / prev - cy / nz;
  view.zoom = nz;
  render();
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.tagName === "INPUT") return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
    return;
  }
  const key = e.key.toUpperCase();
  const map: Record<string, Tool> = {
    V: "select", P: "point", S: "segment", L: "line", C: "circle",
    I: "intersect", M: "midpoint", B: "perp_bis", A: "ang_bis",
  };
  if (map[key]) {
    setTool(map[key]);
  }
  if (key === "ESCAPE") {
    pending = [];
    selectedId = null;
    render();
    updateHud();
  }
  if (key === "DELETE" || key === "BACKSPACE") {
    if (selectedId) {
      const s = cloneState(state);
      deleteObjectCascade(s, selectedId);
      selectedId = null;
      applyState(s);
    }
  }
}

function deleteObjectCascade(s: State, id: string) {
  const toRemove = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const o of s.objects) {
      if (toRemove.has(o.id)) continue;
      if (
        (o.kind === "segment" && (toRemove.has(o.a) || toRemove.has(o.b))) ||
        (o.kind === "line" && (toRemove.has(o.a) || toRemove.has(o.b))) ||
        (o.kind === "circle" && (toRemove.has(o.centre) || (o.through && toRemove.has(o.through))))
      ) {
        toRemove.add(o.id);
        changed = true;
      }
    }
  }
  s.objects = s.objects.filter((o) => !toRemove.has(o.id));
}

// ---------- HUD ----------
function updateHud() {
  const descriptions: Record<Tool, string> = {
    select: "drag points. shift+drag to pan. scroll to zoom.",
    point: "click to place a point. click near an existing point to snap.",
    segment: "click two points (or two spots) to draw a segment.",
    line: "click two points to draw an infinite line.",
    circle: "click the centre, then a point on the circumference.",
    intersect: "click two objects to mark their intersection(s).",
    midpoint: "click a segment to mark its midpoint.",
    perp_bis: "click a segment to draw its perpendicular bisector.",
    ang_bis: "click three points: B, then vertex A, then C, to bisect angle BAC.",
  };
  const tips = [
    `<strong>${activeTool}</strong>: ${descriptions[activeTool]}`,
  ];
  if (pending.length > 0) {
    tips.push(`waiting for ${expectedCount(activeTool) - pending.length} more click(s)`);
  }
  tips.push(`x ${mouseWorld.x.toFixed(0)} · y ${mouseWorld.y.toFixed(0)} · zoom ${view.zoom.toFixed(2)}`);
  hud.innerHTML = tips.join("<br>");
}

function expectedCount(t: Tool): number {
  switch (t) {
    case "segment":
    case "line":
    case "circle":
    case "intersect":
      return 2;
    case "ang_bis":
      return 3;
    default:
      return 1;
  }
}

// ---------- save/load/export ----------
function saveJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `geolite-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportPng() {
  const rect = canvas.getBoundingClientRect();
  const off = document.createElement("canvas");
  const dpr = 2;
  off.width = rect.width * dpr;
  off.height = rect.height * dpr;
  const octx = off.getContext("2d")!;
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  octx.fillStyle = "#fff";
  octx.fillRect(0, 0, rect.width, rect.height);

  const saveRect = ctx.canvas;
  const savedRender = render;
  const realCtx = ctx;
  const bindings = bindCtx(octx, rect.width, rect.height);
  bindings.render();
  savedRender; saveRect; realCtx;

  const url = off.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `geolite-${Date.now()}.png`;
  a.click();
}

function bindCtx(c: CanvasRenderingContext2D, w: number, h: number) {
  return {
    render() {
      c.fillStyle = "#fff";
      c.fillRect(0, 0, w, h);
      c.save();
      c.translate(-view.x * view.zoom, -view.y * view.zoom);
      c.scale(view.zoom, view.zoom);
      for (const o of state.objects) if (o.kind === "circle") {
        const centre = getPt(state, o.centre);
        if (!centre) continue;
        const r = circleRadius(o);
        if (!isFinite(r)) continue;
        c.strokeStyle = o.construction ? "#aaa" : "#111";
        c.setLineDash(o.construction ? [4 / view.zoom, 4 / view.zoom] : []);
        c.lineWidth = 1.2 / view.zoom;
        c.beginPath();
        c.arc(centre.x, centre.y, r, 0, Math.PI * 2);
        c.stroke();
      }
      c.setLineDash([]);
      for (const o of state.objects) if (o.kind === "line") {
        const a = getPt(state, o.a), b = getPt(state, o.b);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const t = 10_000;
        c.strokeStyle = "#111";
        c.lineWidth = 1 / view.zoom;
        c.beginPath();
        c.moveTo(a.x - dx * t, a.y - dy * t);
        c.lineTo(a.x + dx * t, a.y + dy * t);
        c.stroke();
      }
      for (const o of state.objects) if (o.kind === "segment") {
        const a = getPt(state, o.a), b = getPt(state, o.b);
        if (!a || !b) continue;
        c.strokeStyle = "#111";
        c.lineWidth = 1.4 / view.zoom;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
      for (const o of state.objects) if (o.kind === "point") {
        c.fillStyle = o.construction ? "#999" : "#111";
        c.beginPath();
        c.arc(o.x, o.y, 3.5 / view.zoom, 0, Math.PI * 2);
        c.fill();
        if (o.label) {
          c.fillStyle = "#00695c";
          c.font = `500 ${12 / view.zoom}px JetBrains Mono, monospace`;
          c.fillText(o.label, o.x + 7 / view.zoom, o.y - 6 / view.zoom);
        }
      }
      c.restore();
    },
  };
}

function loadJsonFromFile(file: File) {
  file.text().then((text) => {
    try {
      const parsed = JSON.parse(text) as State;
      if (!parsed.objects || !Array.isArray(parsed.objects)) throw new Error("invalid");
      applyState(parsed);
    } catch (err) {
      alert("Not a valid GeoLite JSON file.");
      void err;
    }
  });
}

// ---------- templates ----------
function openTemplates() {
  tplGrid.innerHTML = "";
  for (const t of TEMPLATES) {
    const b = document.createElement("button");
    b.className = "tpl-item";
    b.innerHTML = `<div class="tpl-name">${t.name}</div><div class="tpl-desc">${t.description}</div>`;
    b.addEventListener("click", () => {
      applyState(t.build());
      tplDialog.close();
    });
    tplGrid.appendChild(b);
  }
  tplDialog.showModal();
}

// ---------- wire up ----------
function wire() {
  document.querySelectorAll<HTMLButtonElement>(".tool[data-tool]").forEach((b) => {
    b.addEventListener("click", () => setTool(b.dataset.tool as Tool));
  });

  document.getElementById("btn-undo")!.addEventListener("click", undo);
  document.getElementById("btn-redo")!.addEventListener("click", redo);
  document.getElementById("btn-save")!.addEventListener("click", saveJson);
  document.getElementById("btn-png")!.addEventListener("click", exportPng);
  document.getElementById("btn-load")!.addEventListener("click", () => fileInput.click());
  document.getElementById("btn-clear")!.addEventListener("click", () => {
    if (confirm("Clear everything?")) applyState(emptyState());
  });
  document.getElementById("btn-template")!.addEventListener("click", openTemplates);
  document.getElementById("tpl-close")!.addEventListener("click", () => tplDialog.close());

  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (f) loadJsonFromFile(f);
    fileInput.value = "";
  });

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  document.addEventListener("keydown", onKeyDown);

  window.addEventListener("resize", resizeCanvas);
}

function init() {
  wire();
  resizeCanvas();
  // Start with a subtle default: load the equilateral template after a short beat.
  // Keep the blank state as the first history entry so first-load undo actually works.
  setTimeout(() => {
    if (state.objects.length === 0) {
      history = [cloneState(state)];
      state = TEMPLATES[0].build();
      future = [];
      render();
      updateHud();
    }
  }, 50);
}

init();
