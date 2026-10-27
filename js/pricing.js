// Pure pricing maths — no DOM, no network. Easy to test.
import { SETTINGS } from './config.js';

export const SIDES = [
  { key: 'front', label: 'Front (long edge)', axis: 'length' },
  { key: 'back',  label: 'Back (long edge)',  axis: 'length' },
  { key: 'left',  label: 'Left (short edge)', axis: 'width'  },
  { key: 'right', label: 'Right (short edge)', axis: 'width' },
];

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: SETTINGS.currency });
export const money = (n) => gbp.format(Number(n) || 0);

/** Normalise so length is always the longer side. */
export function normalise(l, w) {
  l = Math.round(Number(l) || 0); w = Math.round(Number(w) || 0);
  return l >= w ? { length: l, width: w } : { length: w, width: l };
}

/** Does a piece (l × w) fit on an offcut, allowing rotation and the cut allowance? */
export function fits(offcut, l, w) {
  const a = SETTINGS.cutAllowanceMm || 0;
  const pl = l + a, pw = w + a;
  const ol = offcut.length_mm, ow = offcut.width_mm;
  return (pl <= ol && pw <= ow) || (pl <= ow && pw <= ol);
}

/**
 * Price a piece.
 * @param offcut   { price_per_m2 }
 * @param l, w     piece size in mm (l = the side called "length" by the customer)
 * @param edges    { front: finishId|null, back, left, right }
 * @param finishes array of { id, name, price_per_m }
 */
export function quote(offcut, l, w, edges = {}, finishes = []) {
  const L = Number(l) || 0, W = Number(w) || 0;
  const areaM2 = (L * W) / 1e6;
  const stone = areaM2 * Number(offcut.price_per_m2 || 0);

  const byId = Object.fromEntries(finishes.map((f) => [f.id, f]));
  const edgeLines = [];
  let edgeTotal = 0;
  for (const side of SIDES) {
    const f = byId[edges[side.key]];
    if (!f) continue;
    const metres = (side.axis === 'length' ? L : W) / 1000;
    const cost = metres * Number(f.price_per_m || 0);
    edgeTotal += cost;
    edgeLines.push({ side: side.key, sideLabel: side.label, finish: f.name, metres, rate: Number(f.price_per_m), cost });
  }

  let total = stone + edgeTotal;
  const min = SETTINGS.minimumCharge || 0;
  const minApplied = min > 0 && total < min;
  if (minApplied) total = min;

  return {
    areaM2, stone, edgeLines, edgeTotal,
    total: Math.round(total * 100) / 100,
    minApplied,
  };
}

/** All offcuts that fit, cheapest first, each with its quote. */
export function compare(offcuts, l, w, edges, finishes) {
  return offcuts
    .filter((o) => o.status === 'available' && fits(o, l, w))
    .map((o) => ({ offcut: o, q: quote(o, l, w, edges, finishes) }))
    .sort((a, b) => a.q.total - b.q.total);
}
