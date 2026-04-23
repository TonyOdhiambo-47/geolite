# GeoLite

> Geometry that works. No signup. No bloat.

Compass-and-straightedge in a browser tab. Works offline. Sub-20 KB of JavaScript. Point tool, segment tool, line tool, circle tool, intersections between any two primitives, perpendicular bisector, angle bisector, midpoint, five worked classical templates, undo and redo, save to JSON, export to PNG.

Live: https://geolite.vercel.app

## Why this exists

GeoGebra is the tool secondary-school maths teachers recommend for Euclidean geometry. It is excellent, and it is also a 40 MB download, requires an account to save anywhere, and renders sluggishly on a cheap phone. There is room for a lighter alternative for students on slow connections and shared devices.

GeoLite is that. One HTML page. One JavaScript bundle. No WebGL. No login. No cloud. Your constructions stay on your machine unless you choose to save a JSON file.

## Tools

Each tool has a single-letter shortcut.

| Key | Tool | What it does |
|-----|------|--------------|
| V | Select | Drag points, nudge a construction |
| P | Point | Click to place a point. Click near an existing point to snap to it |
| S | Segment | Click two points for a finite segment |
| L | Line | Click two points for an infinite line |
| C | Circle | Click centre, then a point on the circumference |
| I | Intersect | Click any two objects (lines, circles, segments) and mark their intersection(s) |
| M | Midpoint | Click a segment to mark its midpoint |
| B | Perpendicular bisector | Click a segment |
| A | Angle bisector | Click three points: the first, then the vertex, then the third |

**Other keys**: `Ctrl+Z` undo, `Ctrl+Shift+Z` redo, `Delete` remove selected, `Shift+drag` to pan, `scroll` to zoom, `Esc` to cancel a pending operation.

## The math under the hood

Every algorithm comes from a named and checkable source. Nothing is inferred by a language model.

- **Line and line intersection**: determinant form from Wikipedia "Line-line intersection"
- **Line and circle intersection**: quadratic form from Paul Bourke's notes, confirmed against "Line-sphere intersection" Wikipedia article
- **Circle and circle intersection**: Paul Bourke, "Intersection of two circles"
- **Perpendicular bisector**: midpoint plus the perpendicular direction (Wikipedia "Bisection")
- **Angle bisector**: sum of unit vectors along the two rays, handles the anti-parallel edge case by rotating 90 degrees
- **Circumcenter**: closed-form Cartesian formula (Wikipedia "Circumscribed circle")
- **Incenter**: barycentric a:b:c (Wikipedia "Incenter")

All implementations live in `src/geometry.ts`. They are 60 lines total and you can read them in two minutes.

## Templates

Five worked constructions loadable from the template gallery:

1. **Equilateral triangle** on a given segment (Euclid I.1)
2. **Perpendicular bisector** with the two-circle construction (Euclid I.10)
3. **Angle bisector** from vertex with arc (Euclid I.9)
4. **Circumscribed circle** of a triangle (Euclid IV.5)
5. **Regular hexagon** inscribed in a circle (Euclid IV.15)

Each template sets up the starting geometry; you can then continue editing freely.

## Running it locally

```bash
git clone https://github.com/TonyOdhiambo-47/geolite.git
cd geolite
npm install
npm run dev
```

Open http://localhost:5173.

## Deploying to Vercel

```bash
vercel --prod
```

or push to GitHub and import in Vercel. The `vercel.json` is already correct.

## Contributing

If you add a tool, include a citation to the reference algorithm in the code comment. The point of GeoLite is a maths teacher can audit every construction in the source.

## Licence

MIT. Use it in your classroom, fork it, adapt it.

Built by [Mwendo](https://mwendo.co). Part of the Mwendo open education toolkit.
