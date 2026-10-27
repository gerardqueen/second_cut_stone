// Second Cut Stone mark, redrawn as SVG (stacked stone block + Cinzel wordmark).
// Swap for the original artwork by dropping img/logo.png in and setting USE_IMAGE = true.
const USE_IMAGE = false;

function block(x, y, s) {
  // Isometric block: top diamond with a pinwheel slab pattern, two side faces in layers.
  const P = (u, v) => [x + s * (u * 0.5 + v * 0.5), y + s * (0.275 - u * 0.275 + v * 0.275)];
  const pt = (u, v) => P(u, v).map((n) => n.toFixed(2)).join(',');
  const line = (u1, v1, u2, v2) => `<line x1="${P(u1, v1)[0]}" y1="${P(u1, v1)[1]}" x2="${P(u2, v2)[0]}" y2="${P(u2, v2)[1]}"/>`;
  const h = s * 0.38; // block height
  // Corners: P(0,0)=left, P(1,0)=top, P(1,1)=right, P(0,1)=front.
  const [lx, ly] = P(0, 0), [bx, by] = P(1, 1), [rx, ry] = P(0, 1);
  const top = `${pt(0, 0)} ${pt(1, 0)} ${pt(1, 1)} ${pt(0, 1)}`;
  const left = `${lx},${ly} ${rx},${ry} ${rx},${ry + h} ${lx},${ly + h}`;
  const right = `${rx},${ry} ${bx},${by} ${bx},${by + h} ${rx},${ry + h}`;
  const t = 1 / 3, T = 2 / 3;
  const layers = [1, 2].map((k) => {
    const d = (h / 3) * k;
    return `<line x1="${lx}" y1="${ly + d}" x2="${rx}" y2="${ry + d}"/><line x1="${rx}" y1="${ry + d}" x2="${bx}" y2="${by + d}"/>`;
  }).join('');
  const joint = (ax, ay, cx, cy, f, k0, k1) => {
    const jx = ax + (cx - ax) * f, jy = ay + (cy - ay) * f;
    return `<line x1="${jx}" y1="${jy + (h / 3) * k0}" x2="${jx}" y2="${jy + (h / 3) * k1}"/>`;
  };
  const joints = joint(lx, ly, rx, ry, 0.45, 0, 1) + joint(lx, ly, rx, ry, 0.7, 1, 2) + joint(lx, ly, rx, ry, 0.3, 2, 3)
    + joint(rx, ry, bx, by, 0.55, 0, 1) + joint(rx, ry, bx, by, 0.3, 1, 2) + joint(rx, ry, bx, by, 0.75, 2, 3);
  return `
    <g stroke-linejoin="round">
      <polygon points="${left}" fill="#8e8f91"/>
      <polygon points="${right}" fill="#6f7072"/>
      <polygon points="${top}" fill="#b9babb"/>
      <g stroke="#4d4d4e" stroke-width="${(s / 60).toFixed(2)}" stroke-linecap="round" fill="none" opacity=".75">
        ${line(T, 0, T, T)}${line(t, T, 1, T)}${line(t, t, t, 1)}${line(0, t, T, t)}
        ${layers}${joints}
      </g>
      <polygon points="${top}" fill="none" stroke="#4d4d4e" stroke-width="${(s / 45).toFixed(2)}"/>
      <polygon points="${left}" fill="none" stroke="#4d4d4e" stroke-width="${(s / 45).toFixed(2)}"/>
      <polygon points="${right}" fill="none" stroke="#4d4d4e" stroke-width="${(s / 45).toFixed(2)}"/>
    </g>`;
}

export function logoSVG({ stacked = false, light = false } = {}) {
  if (USE_IMAGE) return `<img src="img/logo.png" alt="Second Cut Stone" class="logo-img${stacked ? ' stacked' : ''}">`;
  const ink = light ? '#ffffff' : '#3a3a3b';
  const rule = light ? 'rgba(255,255,255,.7)' : '#6f7072';
  if (stacked) {
    return `<svg class="logo stacked" viewBox="0 0 220 170" role="img" aria-label="Second Cut Stone">
      ${block(66, 4, 88)}
      <text x="110" y="134" text-anchor="middle" font-family="Cinzel, 'Trajan Pro', Georgia, serif" font-weight="600" font-size="31" fill="${ink}" letter-spacing=".5">Second Cut</text>
      <line x1="40" y1="155" x2="80" y2="155" stroke="${rule}" stroke-width="1.2"/>
      <line x1="140" y1="155" x2="180" y2="155" stroke="${rule}" stroke-width="1.2"/>
      <text x="110" y="160" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="600" font-size="14" fill="${ink}" letter-spacing="4">STONE</text>
    </svg>`;
  }
  return `<svg class="logo" viewBox="0 0 250 64" role="img" aria-label="Second Cut Stone">
    ${block(2, 6, 56)}
    <text x="70" y="34" font-family="Cinzel, 'Trajan Pro', Georgia, serif" font-weight="600" font-size="26" fill="${ink}" letter-spacing=".4">Second Cut</text>
    <line x1="70" y1="50" x2="104" y2="50" stroke="${rule}" stroke-width="1"/>
    <line x1="176" y1="50" x2="210" y2="50" stroke="${rule}" stroke-width="1"/>
    <text x="140" y="54.5" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="600" font-size="12" fill="${ink}" letter-spacing="3.5">STONE</text>
  </svg>`;
}
