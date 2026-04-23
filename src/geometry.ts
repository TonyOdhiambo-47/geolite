// Geometry primitives and intersection algorithms.
// Formulas taken from:
// - Wikipedia "Line-line intersection" (determinant form)
// - Paul Bourke, "Intersection of two circles"
// - Wikipedia "Line-sphere intersection" (2D reduction)
// - Wikipedia "Circumscribed circle" (Cartesian)
// - Wikipedia "Incenter" (barycentric)

export interface Pt { x: number; y: number }

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function midpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function perpendicularBisectorLine(a: Pt, b: Pt): { p1: Pt; p2: Pt } {
  const m = midpoint(a, b);
  const n: Pt = { x: -(b.y - a.y), y: b.x - a.x };
  return { p1: m, p2: { x: m.x + n.x, y: m.y + n.y } };
}

export function angleBisectorLine(a: Pt, b: Pt, c: Pt, eps = 1e-9): { p1: Pt; p2: Pt } {
  // Bisector from vertex a, with rays to b and c.
  const ux = b.x - a.x, uy = b.y - a.y;
  const vx = c.x - a.x, vy = c.y - a.y;
  const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
  let dx = ux / lu + vx / lv;
  let dy = uy / lu + vy / lv;
  if (Math.hypot(dx, dy) < eps) {
    dx = -uy / lu;
    dy = ux / lu;
  }
  return { p1: a, p2: { x: a.x + dx, y: a.y + dy } };
}

// Two infinite lines each defined by two points. Returns the intersection or null.
export function lineLineIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt, eps = 1e-9): Pt | null {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < eps) return null;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

// Infinite line (through A, B) intersected with circle (centre C, radius r).
export function lineCircleIntersect(A: Pt, B: Pt, C: Pt, r: number, eps = 1e-9): Pt[] {
  const dx = B.x - A.x, dy = B.y - A.y;
  const fx = A.x - C.x, fy = A.y - C.y;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < -eps) return [];
  if (disc < eps) {
    const t = -b / (2 * a);
    return [{ x: A.x + t * dx, y: A.y + t * dy }];
  }
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a);
  const t2 = (-b + s) / (2 * a);
  return [
    { x: A.x + t1 * dx, y: A.y + t1 * dy },
    { x: A.x + t2 * dx, y: A.y + t2 * dy },
  ];
}

// Two circles, returns 0, 1, or 2 intersection points.
export function circleCircleIntersect(C1: Pt, r1: number, C2: Pt, r2: number, eps = 1e-9): Pt[] {
  const dx = C2.x - C1.x, dy = C2.y - C1.y;
  const d = Math.hypot(dx, dy);
  if (d < eps && Math.abs(r1 - r2) < eps) return [];
  if (d > r1 + r2 + eps) return [];
  if (d < Math.abs(r1 - r2) - eps) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  const h = h2 < 0 ? 0 : Math.sqrt(h2);
  const px = C1.x + (a * dx) / d;
  const py = C1.y + (a * dy) / d;
  if (h < eps) return [{ x: px, y: py }];
  return [
    { x: px + (h * dy) / d, y: py - (h * dx) / d },
    { x: px - (h * dy) / d, y: py + (h * dx) / d },
  ];
}

export function circumcenter(A: Pt, B: Pt, C: Pt, eps = 1e-9): Pt | null {
  const D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
  if (Math.abs(D) < eps) return null;
  const a2 = A.x * A.x + A.y * A.y;
  const b2 = B.x * B.x + B.y * B.y;
  const c2 = C.x * C.x + C.y * C.y;
  const ox = (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / D;
  const oy = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / D;
  return { x: ox, y: oy };
}

export function incenter(A: Pt, B: Pt, C: Pt): { point: Pt; r: number } | null {
  const a = Math.hypot(B.x - C.x, B.y - C.y);
  const b = Math.hypot(C.x - A.x, C.y - A.y);
  const c = Math.hypot(A.x - B.x, A.y - B.y);
  const s = a + b + c;
  if (s < 1e-12) return null;
  const ix = (a * A.x + b * B.x + c * C.x) / s;
  const iy = (a * A.y + b * B.y + c * C.y) / s;
  const area = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2;
  return { point: { x: ix, y: iy }, r: area / (s / 2) };
}
