import { cloneState, emptyState, newId, type State } from "./store";
import { circumcenter, dist, midpoint, type Pt } from "./geometry";

export interface Template {
  id: string;
  name: string;
  description: string;
  build(): State;
}

function addPoint(s: State, p: Pt, label?: string): string {
  const id = newId("p");
  s.objects.push({ id, kind: "point", x: p.x, y: p.y, label: label ?? labelFromIndex(s.nextLabel++) });
  return id;
}

function labelFromIndex(i: number): string {
  const suffix = Math.floor(i / 26);
  const base = String.fromCharCode(65 + (i % 26));
  return suffix === 0 ? base : `${base}${suffix}`;
}

function addSegment(s: State, a: string, b: string) {
  s.objects.push({ id: newId("s"), kind: "segment", a, b });
}

function addCircleThrough(s: State, centre: string, through: string, construction = false) {
  s.objects.push({ id: newId("c"), kind: "circle", centre, through, construction });
}

export const TEMPLATES: Template[] = [
  {
    id: "equilateral",
    name: "Equilateral triangle",
    description: "Construct an equilateral triangle on a given segment using two circles (Euclid I.1).",
    build() {
      const s = cloneState(emptyState());
      const A: Pt = { x: 250, y: 340 };
      const B: Pt = { x: 470, y: 340 };
      const aid = addPoint(s, A);
      const bid = addPoint(s, B);
      addSegment(s, aid, bid);
      addCircleThrough(s, aid, bid, true);
      addCircleThrough(s, bid, aid, true);
      // Intersection above
      const r = dist(A, B);
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2 - Math.sqrt(r * r - (r / 2) ** 2);
      const cid = addPoint(s, { x: mx, y: my });
      addSegment(s, aid, cid);
      addSegment(s, bid, cid);
      return s;
    },
  },
  {
    id: "perp_bisector",
    name: "Perpendicular bisector",
    description: "Two equal-radius circles find the perpendicular bisector of a segment (Euclid I.10).",
    build() {
      const s = cloneState(emptyState());
      const A: Pt = { x: 250, y: 320 };
      const B: Pt = { x: 470, y: 320 };
      const aid = addPoint(s, A);
      const bid = addPoint(s, B);
      addSegment(s, aid, bid);
      addCircleThrough(s, aid, bid, true);
      addCircleThrough(s, bid, aid, true);
      const r = dist(A, B);
      const M = midpoint(A, B);
      const h = Math.sqrt(r * r - (r / 2) ** 2);
      const pid = addPoint(s, { x: M.x, y: M.y - h });
      const qid = addPoint(s, { x: M.x, y: M.y + h });
      s.objects.push({ id: newId("l"), kind: "line", a: pid, b: qid });
      return s;
    },
  },
  {
    id: "angle_bisector",
    name: "Angle bisector",
    description: "The classical compass-and-straightedge bisection of an angle (Euclid I.9).",
    build() {
      const s = cloneState(emptyState());
      const A: Pt = { x: 360, y: 340 };
      const B: Pt = { x: 540, y: 260 };
      const C: Pt = { x: 540, y: 420 };
      const aid = addPoint(s, A);
      const bid = addPoint(s, B);
      const cid = addPoint(s, C);
      s.objects.push({ id: newId("l"), kind: "line", a: aid, b: bid });
      s.objects.push({ id: newId("l"), kind: "line", a: aid, b: cid });
      addCircleThrough(s, aid, bid, true);
      return s;
    },
  },
  {
    id: "circumscribed",
    name: "Circumscribed circle",
    description: "Perpendicular bisectors of two sides meet at the circumcenter (Euclid IV.5).",
    build() {
      const s = cloneState(emptyState());
      const A: Pt = { x: 260, y: 420 };
      const B: Pt = { x: 520, y: 420 };
      const C: Pt = { x: 400, y: 220 };
      const aid = addPoint(s, A);
      const bid = addPoint(s, B);
      const cid = addPoint(s, C);
      addSegment(s, aid, bid);
      addSegment(s, bid, cid);
      addSegment(s, cid, aid);
      const O = circumcenter(A, B, C);
      if (O) {
        const oid = addPoint(s, O, "O");
        const through = aid;
        s.objects.push({ id: newId("c"), kind: "circle", centre: oid, through });
      }
      return s;
    },
  },
  {
    id: "hexagon",
    name: "Regular hexagon",
    description: "Six arcs of the circle's radius, stepped around the circumference (Euclid IV.15).",
    build() {
      const s = cloneState(emptyState());
      const O: Pt = { x: 400, y: 340 };
      const r = 140;
      const oid = addPoint(s, O, "O");
      const pointIds: string[] = [];
      for (let i = 0; i < 6; i++) {
        const theta = (Math.PI / 3) * i;
        const p = { x: O.x + r * Math.cos(theta), y: O.y + r * Math.sin(theta) };
        pointIds.push(addPoint(s, p));
      }
      addCircleThrough(s, oid, pointIds[0], true);
      for (let i = 0; i < 6; i++) {
        addSegment(s, pointIds[i], pointIds[(i + 1) % 6]);
      }
      return s;
    },
  },
];
