// Shared UI bits: header/footer, stone swatches, edge picker + diagram.
import { SETTINGS, DEMO_MODE } from './config.js';
import { logoSVG } from './logo.js';
import { money } from './pricing.js';
import { SHAPES, SHAPE_KEYS, SHAPE_ICONS, geometry } from './shapes.js';
import { profileSVG, profileOf } from './profiles.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const mm = (n) => `${Number(n).toLocaleString('en-GB')}mm`;

export function mountChrome({ admin = false, home = true } = {}) {
  const base = home ? '' : './';
  const h = $('#site-header');
  if (h) {
    h.innerHTML = `
      ${DEMO_MODE ? `<div class="demo-banner">Demo mode — sample stock saved in this browser only. Add your Supabase keys in <code>js/config.js</code> to go live.</div>` : ''}
      <div class="wrap">
        <a class="brand" href="./" aria-label="Second Cut Stone home">${logoSVG()}</a>
        <button class="menu-btn" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
        <nav class="nav">
          ${admin
            ? `<a href="./">View site</a><a href="#" data-signout hidden>Sign out</a>`
            : `<a href="${base}#finder">Find a cut</a><a href="${base}#stock">In the yard</a><a href="${base}#pricing">Edges &amp; pricing</a><a href="#contact">Contact</a>`}
          <a class="parent" href="${SETTINGS.contact.parent}" target="_blank" rel="noopener">Granite Systems ↗</a>
        </nav>
      </div>`;
    const btn = $('.menu-btn', h), nav = $('.nav', h);
    btn.addEventListener('click', () => { const o = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
    $$('.nav a', h).forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));
  }
  const f = $('#site-footer');
  if (f) {
    const c = SETTINGS.contact;
    f.innerHTML = `
      <div class="wrap">
        <div class="cols">
          <div>
            ${logoSVG({ stacked: true, light: true })}
            <p style="margin-top:14px">Premium stone offcuts from the Granite Systems workshop, cut and finished to your size.</p>
          </div>
          <div id="contact">
            <h4>Visit the yard</h4>
            <address>${c.address.map(esc).join('<br>')}</address>
          </div>
          <div>
            <h4>Get in touch</h4>
            <p style="margin:0"><a href="tel:${c.phone.replace(/\s/g, '')}">${esc(c.phone)}</a><br>
            <a href="mailto:${esc(c.email)}">${esc(c.email)}</a><br>
            <a href="${c.facebook}" target="_blank" rel="noopener">Facebook</a></p>
          </div>
        </div>
        <div class="legal">
          <span>© ${new Date().getFullYear()} Second Cut Stone · Part of <a href="${c.parent}" target="_blank" rel="noopener">Granite Systems</a></span>
          <span><a href="privacy.html">Privacy notice</a> · <a href="admin.html">Staff login</a></span>
        </div>
      </div>`;
  }
}

// ---------- Stone swatch (used when an offcut has no photo yet) ----------
function hash(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; }
function palette(name = '', material = '') {
  const n = `${name} ${material}`.toLowerCase();
  if (/nero|black|absolute|noir|anthracite|ebony/.test(n)) return { base: '#1f2022', fleck: ['#3a3c40', '#55585d', '#0d0d0e'], vein: null };
  if (/calacatta|gold/.test(n)) return { base: '#f2efe9', fleck: ['#e2ddd4', '#d6cfc2'], vein: '#b39a6b' };
  if (/carrara|statuario|marble/.test(n)) return { base: '#eeeeec', fleck: ['#dcdcdb', '#cfd0d1'], vein: '#9a9c9f' };
  if (/concrete|grey|gray|cement|kelya|dekton/.test(n)) return { base: '#8d8b87', fleck: ['#7a7874', '#a19f9a', '#6b6966'], vein: null };
  if (/kashmir|bianco|white|pure|snow/.test(n)) return { base: '#ece9e3', fleck: ['#9b958c', '#c5bfb5', '#6f6a63', '#d8b9a4'], vein: null };
  if (/brown|baltic|coffee|tan/.test(n)) return { base: '#4a3b31', fleck: ['#6e5646', '#2c221c', '#8a6f5a'], vein: null };
  return { base: '#b7b5b0', fleck: ['#8f8d89', '#d0cec9', '#6d6b67'], vein: null };
}
export function swatchSVG(o, { w = 400, h = 300 } = {}) {
  const p = palette(o.name, o.material), r = rng(hash(o.id || o.ref || o.name));
  const W = w, H = h, gid = hash((o.id || o.name) + Math.random()).toString(36);
  let flecks = '';
  const count = Math.min(3000, Math.round((p.vein ? 140 : 900) * (W * H) / 120000));
  for (let i = 0; i < count; i++) {
    const x = (r() * W).toFixed(1), y = (r() * H).toFixed(1), s = (r() * (p.vein ? 1.2 : 2.4) + .4).toFixed(1);
    flecks += `<circle cx="${x}" cy="${y}" r="${s}" fill="${p.fleck[i % p.fleck.length]}" opacity="${(.35 + r() * .6).toFixed(2)}"/>`;
  }
  let veins = '';
  if (p.vein) {
    for (let i = 0; i < Math.max(4, Math.round(W / 120)); i++) {
      const y0 = r() * H, y1 = r() * H; // veins sweep across the slab
      veins += `<path d="M -20 ${y0.toFixed(0)} C ${(W * .3).toFixed(0)} ${(y0 + (r() - .5) * 160).toFixed(0)}, ${(W * .65).toFixed(0)} ${(y1 + (r() - .5) * 160).toFixed(0)}, ${W + 20} ${y1.toFixed(0)}" stroke="${p.vein}" stroke-width="${(r() * 2.5 + .6).toFixed(1)}" fill="none" opacity="${(.35 + r() * .45).toFixed(2)}"/>`;
    }
  }
  return `<svg class="swatch" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(o.name)} sample">
    <rect width="${W}" height="${H}" fill="${p.base}"/>${veins}${flecks}
    <rect width="${W}" height="${H}" fill="url(#sh-${gid})" opacity=".18"/>
    <defs><linearGradient id="sh-${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000"/></linearGradient></defs>
  </svg>`;
}
export const media = (o, size) =>
  o.photo_url ? `<img src="${esc(o.photo_url)}" alt="${esc(o.name)}" loading="lazy">` : swatchSVG(o, size);

// ---------- Piece builder (shape → measurements → edges) ----------
/**
 * Renders the shape picker, the measurements that shape needs, a live drawing,
 * and an edge-finish choice for each edge of the shape.
 * Returns { get(), set(state) } where state = { shape, dims, modes, hand, edges }
 * and get() also returns `piece` (the geometry from shapes.js).
 */
export function pieceBuilder(root, finishes, { onChange, idPrefix = root.id } = {}) {
  const state = { shape: 'rectangle', dims: {}, modes: {}, hand: 'left', edges: {} };

  root.innerHTML = `
    <div class="builder">
      <span class="label">1 · Shape</span>
      <div class="shapes" role="radiogroup" aria-label="Shape">
        ${SHAPE_KEYS.map((k) => `
          <button type="button" class="shape-tile" role="radio" data-shape="${k}" title="${esc(SHAPES[k].hint)}">
            <svg viewBox="0 0 48 36" aria-hidden="true">${SHAPE_ICONS[k]}</svg>
            <span>${esc(SHAPES[k].label)}</span>
          </button>`).join('')}
      </div>
      <p class="hint shape-hint"></p>
      <span class="label">2 · Measurements</span>
      <div class="dims"></div>
      <p class="error dims-error" hidden></p>
      <div class="diagram" aria-hidden="true"></div>
      <span class="label">3 · Finished edges</span>
      <div class="edge-grid"></div>
      <div class="quick"></div>
    </div>`;

  const dimsEl = $('.dims', root), diag = $('.diagram', root), edgeGrid = $('.edge-grid', root), quickEl = $('.quick', root);
  let piece = geometry(state.shape, state.dims, state.hand);
  const emit = () => onChange?.(api.get());

  // ----- measurements -----
  function renderDims() {
    const def = SHAPES[state.shape];
    $('.shape-hint', root).textContent = def.hint;
    $$('.shape-tile', root).forEach((t) => { const on = t.dataset.shape === state.shape; t.classList.toggle('active', on); t.setAttribute('aria-checked', on); });
    dimsEl.innerHTML = `
      ${def.hand ? `
        <div class="field">
          <span class="label">Return on the</span>
          <div class="seg" role="radiogroup">
            ${['left', 'right'].map((h) => `<button type="button" data-hand="${h}" class="${state.hand === h ? 'active' : ''}">${h === 'left' ? 'Left' : 'Right'}</button>`).join('')}
          </div>
        </div>` : ''}
      <div class="dim-grid ${def.fields.length === 1 ? 'one' : ''}">
        ${def.fields.map((f) => {
          const mode = f.alt && state.modes[f.key] === 'alt' ? f.alt : null;
          const val = state.dims[f.key] ? Math.round(state.dims[f.key] * (mode ? mode.factor : 1)) : '';
          return `
          <div class="field">
            <label for="${idPrefix}-${f.key}">${esc(mode ? mode.label : f.label)}</label>
            ${f.alt ? `<div class="seg small">
                <button type="button" data-mode="${f.key}:main" class="${mode ? '' : 'active'}">${esc(f.label.split(' (')[0])}</button>
                <button type="button" data-mode="${f.key}:alt" class="${mode ? 'active' : ''}">${esc(f.alt.label)}</button>
              </div>` : ''}
            <div class="unit" data-unit="mm"><input id="${idPrefix}-${f.key}" data-dim="${f.key}" type="number" inputmode="numeric" min="1" step="1" placeholder="${esc(mode ? 'e.g. ' + Math.round(parseInt(f.ph.replace(/\D/g, ''), 10) * mode.factor) : f.ph)}" value="${val}"></div>
          </div>`;
        }).join('')}
      </div>`;
    $$('[data-dim]', dimsEl).forEach((inp) => inp.addEventListener('input', () => {
      const f = SHAPES[state.shape].fields.find((x) => x.key === inp.dataset.dim);
      const n = parseFloat(inp.value);
      const alt = f.alt && state.modes[f.key] === 'alt';
      state.dims[f.key] = n > 0 ? (alt ? n / f.alt.factor : n) : 0;
      update(false);
    }));
    $$('[data-mode]', dimsEl).forEach((b) => b.addEventListener('click', () => {
      const [k, m] = b.dataset.mode.split(':');
      state.modes[k] = m === 'alt' ? 'alt' : '';
      renderDims(); update(false);
      $(`[data-dim="${k}"]`, dimsEl)?.focus();
    }));
    $$('[data-hand]', dimsEl).forEach((b) => b.addEventListener('click', () => { state.hand = b.dataset.hand; renderDims(); update(true); }));
  }

  // ----- edges -----
  function renderEdges() {
    const edges = piece.valid ? piece.edges : geometry(state.shape, sampleDims(state.shape), state.hand).edges;
    // keep choices for edges that still exist on this shape
    state.edges = Object.fromEntries(edges.map((e) => [e.key, state.edges[e.key] || '']));
    edgeGrid.classList.toggle('one', edges.length === 1);
    const numbered = edges.length > 4;
    edgeGrid.innerHTML = edges.map((e, i) => `
      <div class="field">
        <label for="${idPrefix}-edge-${e.key}">${numbered ? `<span class="edge-no">${i + 1}</span>` : ''}${esc(e.label)}${e.curved && edges.length > 1 ? ' <span class="muted">· curved</span>' : ''}</label>
        ${finishPickerHTML(`${idPrefix}-edge-${e.key}`, e.key, finishes)}
      </div>`).join('');
    $$('.fp', edgeGrid).forEach((el) => bindFinishPicker(el, finishes, state.edges[el.dataset.edge] || '', (v) => {
      state.edges[el.dataset.edge] = v; draw(); emit();
    }));
    const keys = edges.map((e) => e.key);
    const chips = [['none', 'No finished edges'], ['all', edges.length === 1 ? 'Finish the edge' : 'All edges']];
    if (keys.includes('front') && edges.length > 2) chips.splice(1, 0, ['front', 'Front only']);
    if (state.shape === 'rectangle' || state.shape === 'square') chips.splice(2, 0, ['three', 'Front + both ends']);
    if (state.shape === 'lshape') chips.splice(2, 0, ['exposed', 'Front edges + ends']);
    quickEl.innerHTML = `<span class="label">Quick set</span><div class="quick-row">${chips.map(([k, t]) => `<button type="button" class="chip" data-quick="${k}">${t}</button>`).join('')}</div>`;
    $$('[data-quick]', quickEl).forEach((b) => b.addEventListener('click', () => {
      const def = Object.values(state.edges).find(Boolean) || finishes[0]?.id || '';
      const want = {
        none: [], all: keys, front: ['front'], three: ['front', 'left', 'right'],
        exposed: ['front', 'returnFront', 'runEnd', 'returnEnd'],
      }[b.dataset.quick];
      for (const k of keys) state.edges[k] = want.includes(k) ? (state.edges[k] || def) : '';
      $$('.fp', edgeGrid).forEach((el) => el.fpSet(state.edges[el.dataset.edge] || ''));
      draw(); emit();
    }));
  }

  // ----- drawing -----
  function draw() {
    const g = piece.valid ? piece : geometry(state.shape, sampleDims(state.shape), state.hand);
    // Shapes with many edges get numbered markers (matching the numbered dropdowns) instead of
    // text labels, which would collide at inner corners.
    const numbered = g.edges.length > 4;
    const W = 400, H = 220, padX = numbered ? 30 : 92, padY = 30;
    const s = Math.min((W - padX * 2) / g.bboxL, (H - padY * 2) / g.bboxW);
    const ox = (W - g.bboxL * s) / 2, oy = (H - g.bboxW * s) / 2;
    const name = (k) => finishes.find((f) => f.id === state.edges[k])?.name;
    const sw = 1 / s; // 1px in mm units
    const ink = '#1e2843', quiet = '#8a8a8a', font = 'font-family="Jost, sans-serif"';
    const edgeMarks = g.edges.map((e) => {
      const on = !!state.edges[e.key];
      return `<path d="${e.d}" fill="none" stroke="${on ? ink : '#a7a7a7'}" stroke-width="${(on ? 6 : 2) * sw}" ${on ? '' : `stroke-dasharray="${5 * sw} ${5 * sw}"`} stroke-linecap="round"/>`;
    }).join('');
    let labels;
    if (g.edges.length === 1) {
      const n = name('edge');
      labels = `<text x="${W / 2}" y="${H - 4}" text-anchor="middle" font-size="11" fill="${n ? ink : quiet}" ${font}>${esc(n ? 'Edge: ' + n : 'Edge: cut')}</text>`;
    } else if (numbered) {
      labels = g.edges.map((e, i) => {
        const x = ox + e.mx * s + e.nx * 13, y = oy + e.my * s + e.ny * 13;
        const on = !!state.edges[e.key];
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="${on ? ink : '#fff'}" stroke="${on ? ink : '#b5b5b5'}"/>
          <text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="middle" font-size="10" fill="${on ? '#fff' : '#666'}" ${font}>${i + 1}</text>`;
      }).join('');
    } else {
      labels = g.edges.map((e) => {
        const side = Math.abs(e.nx) > 0.5;
        const x = ox + e.mx * s + e.nx * 10, y = oy + e.my * s + e.ny * 14 + (side ? 4 : 4);
        const anchor = side ? (e.nx > 0 ? 'start' : 'end') : 'middle';
        const n = name(e.key);
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-size="11" fill="${n ? ink : quiet}" ${font}>${esc(n || 'cut')}</text>`;
      }).join('');
    }
    diag.innerHTML = `<svg viewBox="0 0 ${W} ${H + 16}">
      <g transform="translate(${ox} ${oy}) scale(${s})">
        <path d="${g.outline}" fill="#c9c8c4" ${piece.valid ? '' : 'opacity=".45"'}/>
        ${edgeMarks}
      </g>
      ${labels}
      <text x="${W / 2}" y="${(state.shape === 'semicircle' ? oy + g.bboxW * s * 0.42 : state.shape === 'lshape' ? oy + Math.min(g.bboxW, Number(state.dims.depth) || g.bboxW) * s / 2 : oy + (g.bboxW * s) / 2) + 5}" text-anchor="middle" font-size="13" fill="#4d4d4e" ${font}>${piece.valid ? esc(dimLabel()) : 'Enter measurements'}</text>
      <text x="${W / 2}" y="${H + 12}" text-anchor="middle" font-size="9" fill="#9a9a9a" letter-spacing="2" ${font}>FRONT</text>
    </svg>`;
  }
  function dimLabel() {
    const d = state.dims, r = Math.round;
    return {
      rectangle: `${mm(r(d.length))} × ${mm(r(d.width))}`, square: `${mm(r(d.side))} square`,
      circle: `⌀ ${mm(r(d.diameter))}`, oval: `${mm(r(d.length))} × ${mm(r(d.width))}`,
      semicircle: `${mm(r(d.diameter))} wide`, lshape: `${mm(r(d.length))} × ${mm(r(d.returnLength))}`,
    }[state.shape];
  }

  function update(rebuildEdges) {
    const before = piece.edges.map((e) => e.key).join();
    piece = geometry(state.shape, state.dims, state.hand);
    const err = $('.dims-error', root);
    err.hidden = !piece.error; err.textContent = piece.error || '';
    if (rebuildEdges || piece.edges.map((e) => e.key).join() !== before) renderEdges();
    draw(); emit();
  }

  $$('.shape-tile', root).forEach((t) => t.addEventListener('click', () => {
    if (state.shape === t.dataset.shape) return;
    const prev = state.dims;
    state.shape = t.dataset.shape;
    // carry sensible measurements across shapes
    const L = prev.length || prev.side || prev.diameter, W = prev.width || prev.depth || prev.side;
    state.dims = {
      rectangle: { length: L, width: W }, square: { side: L }, circle: { diameter: L },
      oval: { length: L, width: W }, semicircle: { diameter: L },
      lshape: { length: L, depth: W, returnLength: prev.returnLength, returnDepth: prev.returnDepth || W },
    }[state.shape];
    renderDims(); update(true);
  }));

  const api = {
    get: () => ({ shape: state.shape, dims: { ...state.dims }, modes: { ...state.modes }, hand: state.hand, edges: { ...state.edges }, piece }),
    set(v) {
      Object.assign(state, { shape: v.shape || 'rectangle', dims: { ...(v.dims || {}) }, modes: { ...(v.modes || {}) }, hand: v.hand || 'left', edges: { ...(v.edges || {}) } });
      piece = geometry(state.shape, state.dims, state.hand);
      renderDims(); renderEdges(); draw();
    },
    /** Plain-English description of the piece and its edges, for enquiries. */
    describe() {
      const fin = (k) => finishes.find((f) => f.id === state.edges[k])?.name;
      const done = piece.edges.filter((e) => fin(e.key)).map((e) => `${e.label}: ${fin(e.key)}`);
      return { summary: piece.summary, edges: done.length ? done.join('; ') : 'No finished edges' };
    },
  };
  renderDims(); renderEdges(); draw();
  return api;
}

function sampleDims(shape) {
  return {
    rectangle: { length: 1000, width: 500 }, square: { side: 600 }, circle: { diameter: 600 },
    oval: { length: 1000, width: 600 }, semicircle: { diameter: 900 },
    lshape: { length: 2000, depth: 600, returnLength: 1400, returnDepth: 600 },
  }[shape];
}

// ---------- Finish picker (a drop-down that shows each edge profile) ----------
const finishLabel = (f) => f
  ? `${profileSVG(profileOf(f), { size: 44 })}<span class="fp-name">${esc(f.name)}</span><span class="fp-price">${money(f.price_per_m).replace('.00', '')}/m</span>`
  : `${profileSVG('sawn', { size: 44 })}<span class="fp-name">Unfinished</span><span class="fp-price">Free</span>`;

export function finishPickerHTML(id, edgeKey, finishes) {
  return `<div class="fp" data-edge="${esc(edgeKey)}">
    <button type="button" class="fp-btn" id="${esc(id)}" aria-haspopup="listbox" aria-expanded="false"></button>
    <ul class="fp-list" role="listbox" tabindex="-1" hidden>
      <li role="option" data-value="" tabindex="-1">${finishLabel(null)}<small>Sawn edge, for sides against a wall or unit</small></li>
      ${finishes.map((f) => `<li role="option" data-value="${esc(f.id)}" tabindex="-1">${finishLabel(f)}${f.description ? `<small>${esc(f.description)}</small>` : ''}</li>`).join('')}
    </ul>
  </div>`;
}

let openPicker = null;
document.addEventListener('click', (e) => { if (openPicker && !openPicker.contains(e.target)) openPicker.fpClose(); });

export function bindFinishPicker(el, finishes, value, onChange) {
  const btn = $('.fp-btn', el), list = $('.fp-list', el), opts = $$('[role=option]', list);
  let current = value;
  const render = () => {
    btn.innerHTML = `${finishLabel(finishes.find((f) => f.id === current))}<span class="fp-caret" aria-hidden="true">▾</span>`;
    opts.forEach((o) => o.setAttribute('aria-selected', o.dataset.value === current));
  };
  el.fpSet = (v) => { current = v; render(); };
  el.fpClose = () => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); el.classList.remove('open'); if (openPicker === el) openPicker = null; };
  const open = () => {
    if (openPicker && openPicker !== el) openPicker.fpClose();
    list.hidden = false; btn.setAttribute('aria-expanded', 'true'); el.classList.add('open'); openPicker = el;
    // open upwards if there's no room below
    const r = btn.getBoundingClientRect();
    el.classList.toggle('up', window.innerHeight - r.bottom < Math.min(list.scrollHeight, 320) + 16 && r.top > 340);
    (opts.find((o) => o.dataset.value === current) || opts[0]).focus();
  };
  const choose = (v) => { current = v; render(); el.fpClose(); btn.focus(); onChange(v); };
  btn.addEventListener('click', () => (list.hidden ? open() : el.fpClose()));
  btn.addEventListener('keydown', (e) => { if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); open(); } });
  opts.forEach((o, i) => {
    o.addEventListener('click', () => choose(o.dataset.value));
    o.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(i + 1, opts.length - 1)].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); opts[Math.max(i - 1, 0)].focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(o.dataset.value); }
      else if (e.key === 'Escape' || e.key === 'Tab') { el.fpClose(); btn.focus(); }
    });
  });
  render();
}
