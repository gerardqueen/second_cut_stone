// Shape catalogue: which measurements each shape needs, and its geometry.
// All maths in millimetres. x runs left→right along the piece, y runs back→front
// (y = 0 is the back/wall side, the largest y is the front facing the customer).

const PI = Math.PI;
const round = (n) => Math.round(n);

/** Fields a shape asks for. `alt` lets a field be entered as a radius instead of a diameter. */
export const SHAPES = {
  rectangle: {
    label: 'Rectangle',
    hint: 'Vanity tops, shelves, sills, splashbacks',
    fields: [
      { key: 'length', label: 'Length', ph: 'e.g. 1200' },
      { key: 'width', label: 'Depth', ph: 'e.g. 500' },
    ],
  },
  square: {
    label: 'Square',
    hint: 'Hearths, worktop savers, side tables',
    fields: [{ key: 'side', label: 'Side length', ph: 'e.g. 600' }],
  },
  circle: {
    label: 'Circle',
    hint: 'Table tops, round hearths, coasters',
    fields: [{ key: 'diameter', label: 'Diameter', ph: 'e.g. 600', alt: { key: 'radius', label: 'Radius', factor: 0.5 } }],
  },
  oval: {
    label: 'Oval',
    hint: 'Table tops, basin surrounds',
    fields: [
      { key: 'length', label: 'Length', ph: 'e.g. 1200' },
      { key: 'width', label: 'Width', ph: 'e.g. 700' },
    ],
  },
  semicircle: {
    label: 'Half-moon',
    hint: 'D-shaped hearths, corner shelves',
    fields: [{ key: 'diameter', label: 'Width', ph: 'e.g. 900', alt: { key: 'radius', label: 'Radius', factor: 0.5 } }],
  },
  lshape: {
    label: 'L-shape',
    hint: 'Corner worktops, L-shaped vanities',
    fields: [
      { key: 'length', label: 'Overall length', ph: 'e.g. 2000' },
      { key: 'depth', label: 'Main run depth', ph: 'e.g. 600' },
      { key: 'returnLength', label: 'Overall return', ph: 'e.g. 1500' },
      { key: 'returnDepth', label: 'Return depth', ph: 'e.g. 600' },
    ],
    hand: true, // return on the left or right
  },
};
export const SHAPE_KEYS = Object.keys(SHAPES);

const seg = (x1, y1, x2, y2) => ({ d: `M ${x1} ${y1} L ${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2, nx: y2 - y1, ny: x1 - x2 });

function straightEdges(points, defs) {
  // points form a closed polygon (clockwise in screen coords); defs[i] names edge i (points[i] → points[i+1]).
  return defs.map((def, i) => {
    const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const s = seg(x1, y1, x2, y2);
    const n = Math.hypot(s.nx, s.ny) || 1;
    return { ...def, len, curved: false, d: s.d, mx: s.mx, my: s.my, nx: s.nx / n, ny: s.ny / n };
  });
}

/**
 * Turn a shape + entered dimensions into geometry.
 * @param {string} shape  key of SHAPES
 * @param {object} dims   canonical dimensions in mm (diameter, not radius)
 * @param {'left'|'right'} hand  which side an L-shape's return sits on
 * @returns {{ valid, error?, bboxL, bboxW, areaMm2, edges[], outline, summary }}
 */
export function geometry(shape, dims = {}, hand = 'left') {
  const v = (k) => Math.max(0, Number(dims[k]) || 0);
  const bad = (error) => ({ valid: false, error, edges: [], bboxL: 0, bboxW: 0, areaMm2: 0, outline: '', summary: '' });

  if (shape === 'rectangle' || shape === 'square') {
    const L = shape === 'square' ? v('side') : v('length');
    const W = shape === 'square' ? v('side') : v('width');
    if (!L || !W) return bad();
    const pts = [[0, 0], [L, 0], [L, W], [0, W]];
    const edges = straightEdges(pts, [
      { key: 'back', label: 'Back' },
      { key: 'right', label: 'Right end' },
      { key: 'front', label: 'Front' },
      { key: 'left', label: 'Left end' },
    ]);
    return {
      valid: true, bboxL: L, bboxW: W, areaMm2: L * W, edges,
      outline: `M 0 0 H ${L} V ${W} H 0 Z`,
      summary: shape === 'square' ? `Square ${round(L)}mm` : `Rectangle ${round(L)} × ${round(W)}mm`,
    };
  }

  if (shape === 'circle') {
    const D = v('diameter'); if (!D) return bad();
    const r = D / 2;
    return {
      valid: true, bboxL: D, bboxW: D, areaMm2: PI * r * r,
      edges: [{ key: 'edge', label: 'Edge, all the way round', len: PI * D, curved: true,
        d: `M 0 ${r} A ${r} ${r} 0 1 0 ${D} ${r} A ${r} ${r} 0 1 0 0 ${r}`, mx: r, my: D, nx: 0, ny: 1 }],
      outline: `M 0 ${r} A ${r} ${r} 0 1 0 ${D} ${r} A ${r} ${r} 0 1 0 0 ${r} Z`,
      summary: `Circle ${round(D)}mm diameter (${round(r)}mm radius)`,
    };
  }

  if (shape === 'oval') {
    const A = v('length'), B = v('width'); if (!A || !B) return bad();
    const a = A / 2, b = B / 2;
    // Ramanujan's approximation for the perimeter of an ellipse.
    const perim = PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    return {
      valid: true, bboxL: A, bboxW: B, areaMm2: PI * a * b,
      edges: [{ key: 'edge', label: 'Edge, all the way round', len: perim, curved: true,
        d: `M 0 ${b} A ${a} ${b} 0 1 0 ${A} ${b} A ${a} ${b} 0 1 0 0 ${b}`, mx: a, my: B, nx: 0, ny: 1 }],
      outline: `M 0 ${b} A ${a} ${b} 0 1 0 ${A} ${b} A ${a} ${b} 0 1 0 0 ${b} Z`,
      summary: `Oval ${round(A)} × ${round(B)}mm`,
    };
  }

  if (shape === 'semicircle') {
    const D = v('diameter'); if (!D) return bad();
    const r = D / 2;
    return {
      valid: true, bboxL: D, bboxW: r, areaMm2: PI * r * r / 2,
      edges: [
        { key: 'back', label: 'Straight back edge', len: D, curved: false, d: `M 0 0 L ${D} 0`, mx: r, my: 0, nx: 0, ny: -1 },
        { key: 'front', label: 'Curved front edge', len: PI * r, curved: true, d: `M ${D} 0 A ${r} ${r} 0 0 1 0 0`, mx: r, my: r, nx: 0, ny: 1 },
      ],
      outline: `M 0 0 L ${D} 0 A ${r} ${r} 0 0 1 0 0 Z`,
      summary: `Half-moon ${round(D)}mm wide, ${round(r)}mm radius`,
    };
  }

  if (shape === 'lshape') {
    const L = v('length'), D1 = v('depth'), R = v('returnLength'), D2 = v('returnDepth');
    if (!L || !D1 || !R || !D2) return bad();
    if (R <= D1) return bad('The return length must be longer than the depth of the main run.');
    if (L <= D2) return bad('The overall length must be longer than the depth of the return.');
    // Left-handed: return runs down the left side. Right-handed is mirrored.
    const left = [[0, 0], [L, 0], [L, D1], [D2, D1], [D2, R], [0, R]];
    let edges = straightEdges(left, [
      { key: 'back', label: 'Back edge' },
      { key: 'runEnd', label: 'Main run end' },
      { key: 'front', label: 'Main run front' },
      { key: 'returnFront', label: 'Return front' },
      { key: 'returnEnd', label: 'Return end' },
      { key: 'side', label: 'Return outer side' },
    ]);
    let pts = left;
    if (hand === 'right') {
      // Mirror left↔right: same edges, same lengths, x flipped (outward normals flip in x too).
      const mx = (x) => L - x;
      pts = left.map(([x, y]) => [mx(x), y]);
      edges = edges.map((e, i) => {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        return { ...e, d: `M ${x1} ${y1} L ${x2} ${y2}`, mx: mx(e.mx), nx: -e.nx };
      });
    }
    const outline = `M ${pts.map((p) => p.join(' ')).join(' L ')} Z`;
    return {
      valid: true, bboxL: L, bboxW: R, areaMm2: L * D1 + D2 * (R - D1), edges, outline,
      summary: `L-shape (return on the ${hand}) ${round(L)} × ${round(R)}mm, depths ${round(D1)}mm / ${round(D2)}mm`,
    };
  }

  return bad('Unknown shape');
}

/** Small outline icons for the shape picker (48 × 36 box). */
export const SHAPE_ICONS = {
  rectangle: '<rect x="4" y="9" width="40" height="18" rx="1"/>',
  square: '<rect x="11" y="5" width="26" height="26" rx="1"/>',
  circle: '<circle cx="24" cy="18" r="13"/>',
  oval: '<ellipse cx="24" cy="18" rx="20" ry="12"/>',
  semicircle: '<path d="M6 10 H42 A18 18 0 0 1 6 10 Z"/>',
  lshape: '<path d="M6 5 H42 V15 H17 V31 H6 Z"/>',
};

/**
 * The piece outline as a list of [x, y] points in mm (same coordinates as `geometry`:
 * x along the length, y from the back edge (0) to the front). Curves are sampled into
 * `seg` points so the 3D slab and anything else can use plain polygons.
 */
export function outlinePoints(shape, dims = {}, hand = 'left', seg = 96) {
  const g = geometry(shape, dims, hand);
  if (!g.valid) return [];
  const v = (k) => Math.max(0, Number(dims[k]) || 0);
  const ellipse = (cx, cy, a, b, from, to, n) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = from + (to - from) * (i / n);
      return [cx + a * Math.cos(t), cy + b * Math.sin(t)];
    });
  switch (shape) {
    case 'rectangle': case 'square':
      return [[0, 0], [g.bboxL, 0], [g.bboxL, g.bboxW], [0, g.bboxW]];
    case 'circle': {
      const r = v('diameter') / 2;
      return ellipse(r, r, r, r, 0, 2 * PI, seg).slice(0, -1);
    }
    case 'oval': {
      const a = v('length') / 2, b = v('width') / 2;
      return ellipse(a, b, a, b, 0, 2 * PI, seg).slice(0, -1);
    }
    case 'semicircle': {
      // straight back edge along y = 0, curve bulging to the front (+y)
      const r = v('diameter') / 2;
      return ellipse(r, 0, r, r, 0, PI, Math.round(seg / 2));
    }
    case 'lshape': {
      const L = v('length'), D1 = v('depth'), R = v('returnLength'), D2 = v('returnDepth');
      const left = [[0, 0], [L, 0], [L, D1], [D2, D1], [D2, R], [0, R]];
      return hand === 'right' ? left.map(([x, y]) => [L - x, y]) : left;
    }
    default:
      return [];
  }
}
