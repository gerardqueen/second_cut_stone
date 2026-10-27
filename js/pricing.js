// Pure pricing maths — no DOM, no network. Easy to test.
import { SETTINGS } from './config.js';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: SETTINGS.currency });
export const money = (n) => gbp.format(Number(n) || 0);

/**
 * Does a piece fit on an offcut? Uses the piece's bounding box (the rectangle it is
 * cut from), allowing rotation and the cut allowance.
 * @param offcut { length_mm, width_mm }
 * @param piece  geometry from shapes.js ({ bboxL, bboxW })
 */
export function fits(offcut, piece) {
  if (!piece?.valid) return false;
  const a = SETTINGS.cutAllowanceMm || 0;
  const pl = piece.bboxL + a, pw = piece.bboxW + a;
  const ol = offcut.length_mm, ow = offcut.width_mm;
  return (pl <= ol && pw <= ow) || (pl <= ow && pw <= ol);
}

/** Is this piece a plain rectangle (where the shape area and the area it's cut from are the same)? */
const isRectangular = (piece) => Math.abs(piece.areaMm2 - piece.bboxL * piece.bboxW) < 1;

/**
 * Price a piece.
 * @param offcut   { price_per_m2 }
 * @param piece    geometry from shapes.js
 * @param edges    { [edgeKey]: finishId | '' }
 * @param finishes [{ id, name, price_per_m }]
 */
export function quote(offcut, piece, edges = {}, finishes = []) {
  const rate = Number(offcut.price_per_m2 || 0);
  const shapeM2 = piece.areaMm2 / 1e6;
  const blockM2 = (piece.bboxL * piece.bboxW) / 1e6;
  // Shaped pieces (circles, ovals, L-shapes…) leave waste that can't be resold, so by default
  // they're charged on the rectangle they're cut from. Set shapedPieceCharge to 'shape' to
  // charge only the finished area instead.
  const chargeBlock = !isRectangular(piece) && SETTINGS.shapedPieceCharge !== 'shape';
  const chargedM2 = chargeBlock ? blockM2 : shapeM2;
  const stone = chargedM2 * rate;

  const byId = Object.fromEntries(finishes.map((f) => [f.id, f]));
  const factor = Number(SETTINGS.curvedEdgeFactor) || 1;
  const edgeLines = [];
  let edgeTotal = 0;
  for (const e of piece.edges) {
    const f = byId[edges[e.key]];
    if (!f) continue;
    const metres = e.len / 1000;
    const r = Number(f.price_per_m || 0) * (e.curved ? factor : 1);
    const cost = metres * r;
    edgeTotal += cost;
    edgeLines.push({ key: e.key, label: e.label, finish: f.name, metres, rate: r, curved: e.curved, cost });
  }

  let total = stone + edgeTotal;
  const min = SETTINGS.minimumCharge || 0;
  const minApplied = min > 0 && total < min;
  if (minApplied) total = min;

  return {
    shapeM2, blockM2, chargedM2, chargeBlock, stone, edgeLines, edgeTotal,
    total: Math.round(total * 100) / 100,
    minApplied,
  };
}

/** All available offcuts the piece fits, cheapest first, each with its quote. */
export function compare(offcuts, piece, edges, finishes) {
  return offcuts
    .filter((o) => o.status === 'available' && fits(o, piece))
    .map((o) => ({ offcut: o, q: quote(o, piece, edges, finishes) }))
    .sort((a, b) => a.q.total - b.q.total);
}
