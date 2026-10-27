// Edge profile outlines: a cross-section of the slab edge, as a customer would see it
// looking along the edge. The slab runs off to the left; the finished edge is on the right.
// viewBox 0 0 64 32 · slab is 20 units thick (y 6 → 26), edge face at x ≈ 54.

const T = 6, B = 26; // top and bottom of the slab

export const PROFILES = {
  sawn: {
    label: 'Unfinished (sawn)',
    d: `M0 ${T} H54 V${B} H0`,
    extra: `<path d="M54 ${T + 2} V${B - 2}" stroke-dasharray="2 2"/>`,
  },
  square: {
    label: 'Square / polished',
    d: `M0 ${T} H53 Q54 ${T} 54 ${T + 1} V${B - 1} Q54 ${B} 53 ${B} H0`,
  },
  pencil: {
    label: 'Pencil round',
    d: `M0 ${T} H50 Q54 ${T} 54 ${T + 4} V${B - 4} Q54 ${B} 50 ${B} H0`,
  },
  bevel: {
    label: 'Bevelled',
    d: `M0 ${T} H47 L54 ${T + 7} V${B - 1} Q54 ${B} 53 ${B} H0`,
  },
  halfBullnose: {
    label: 'Half bullnose',
    d: `M0 ${T} H44 A10 10 0 0 1 54 ${T + 10} V${B - 1} Q54 ${B} 53 ${B} H0`,
  },
  bullnose: {
    label: 'Full bullnose',
    d: `M0 ${T} H44 A10 10 0 0 1 44 ${B} H0`,
  },
  ogee: {
    label: 'Ogee',
    d: `M0 ${T} H44 C50 ${T} 49 ${T + 7} 52 ${T + 9} C54 ${T + 10} 54 ${T + 12} 54 ${T + 14} V${B - 1} Q54 ${B} 53 ${B} H0`,
  },
  dupont: {
    label: 'Dupont',
    d: `M0 ${T} H47 V${T + 4} A7 7 0 0 1 54 ${T + 11} V${B - 1} Q54 ${B} 53 ${B} H0`,
  },
  mitred: {
    label: 'Mitred apron (deeper edge)',
    d: `M0 ${T - 2} H53 Q54 ${T - 2} 54 ${T - 1} V30 Q54 31 53 31 H48 V${B - 6} H0`,
  },
};
export const PROFILE_KEYS = Object.keys(PROFILES);

/** Best-guess profile from a finish's name, for finishes saved before profiles existed. */
export function guessProfile(name = '') {
  const n = name.toLowerCase();
  if (/half.?bull/.test(n)) return 'halfBullnose';
  if (/bull/.test(n)) return 'bullnose';
  if (/ogee/.test(n)) return 'ogee';
  if (/dupont/.test(n)) return 'dupont';
  if (/bevel|chamfer/.test(n)) return 'bevel';
  if (/pencil|eased|round/.test(n)) return 'pencil';
  if (/mitre|miter|apron|drop/.test(n)) return 'mitred';
  if (/saw|unfinish|cut/.test(n)) return 'sawn';
  return 'square';
}

export const profileOf = (finish) => (finish && PROFILES[finish.profile] ? finish.profile : guessProfile(finish?.name));

/** Inline SVG of a profile. `size` is the rendered width in px. */
export function profileSVG(key, { size = 56, title = '' } = {}) {
  const p = PROFILES[key] || PROFILES.square;
  // Cropped to the last 36 units so the edge shape fills the picture; the slab fades off to the left.
  const fid = `pf${Math.random().toString(36).slice(2, 8)}`;
  return `<svg class="profile-svg" viewBox="20 1 37 32" width="${size}" height="${Math.round(size * 32 / 37)}" role="img" aria-label="${title || p.label} edge profile">
    <defs><linearGradient id="${fid}" x1="0" x2="1"><stop offset=".38" stop-color="#d6d5d1" stop-opacity="0"/><stop offset=".56" stop-color="#d6d5d1"/></linearGradient>
    <linearGradient id="${fid}s" x1="0" x2="1"><stop offset=".38" stop-color="#4d4d4e" stop-opacity="0"/><stop offset=".56" stop-color="#4d4d4e"/></linearGradient></defs>
    <path d="${p.d}" fill="url(#${fid})" stroke="url(#${fid}s)" stroke-width="1.3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    ${p.extra ? `<g fill="none" stroke="#4d4d4e" stroke-width="1" vector-effect="non-scaling-stroke">${p.extra}</g>` : ''}
  </svg>`;
}
