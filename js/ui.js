// Shared UI bits: header/footer, stone swatches, edge picker + diagram.
import { SETTINGS, DEMO_MODE } from './config.js';
import { logoSVG } from './logo.js';
import { SIDES, money } from './pricing.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const mm = (n) => `${Number(n).toLocaleString('en-GB')}mm`;

export function mountChrome({ admin = false } = {}) {
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
            : `<a href="#finder">Find a cut</a><a href="#stock">In the yard</a><a href="#pricing">Edges &amp; pricing</a><a href="#contact">Contact</a>`}
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
          <a href="admin.html">Staff login</a>
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

// ---------- Edge picker ----------
/**
 * Renders four edge selects + a live diagram into `root`.
 * Returns { get(), set(values), redraw(length, width) }.
 */
export function edgePicker(root, finishes, { onChange } = {}) {
  const state = { front: '', back: '', left: '', right: '' };
  let L = 1000, W = 600;
  const opt = finishes.map((f) => `<option value="${esc(f.id)}">${esc(f.name)} · ${money(f.price_per_m).replace('.00', '')}/m</option>`).join('');
  root.innerHTML = `
    <div class="edges">
      <div class="diagram" aria-hidden="true"></div>
      <div class="edge-grid">
        ${SIDES.map((s) => `
          <div class="field">
            <label for="${root.id}-${s.key}">${esc(s.label)}</label>
            <select id="${root.id}-${s.key}" data-side="${s.key}"><option value="">Unfinished</option>${opt}</select>
          </div>`).join('')}
      </div>
      <div>
        <span class="label">Quick set</span>
        <div class="quick">
          <button type="button" class="chip" data-quick="none">No finished edges</button>
          <button type="button" class="chip" data-quick="front">Front only</button>
          <button type="button" class="chip" data-quick="three">Front + both ends</button>
          <button type="button" class="chip" data-quick="all">All four</button>
        </div>
      </div>
    </div>`;
  const diag = $('.diagram', root);
  const sels = $$('select', root);

  function draw() {
    const maxW = 340, maxH = 170;
    const ratio = L > 0 && W > 0 ? W / L : .5;
    let w = maxW, h = maxW * ratio;
    if (h > maxH) { h = maxH; w = maxH / ratio; }
    w = Math.max(w, 60); h = Math.max(h, 24);
    const x = (400 - w) / 2, y = 30;
    const name = (k) => finishes.find((f) => f.id === state[k])?.name;
    const edge = (k, x1, y1, x2, y2) => {
      const on = !!state[k];
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${on ? '#1e2843' : '#a7a7a7'}" stroke-width="${on ? 6 : 2}" stroke-dasharray="${on ? '' : '5 5'}" stroke-linecap="round"/>`;
    };
    const lbl = (k, tx, ty, anchor = 'middle', rot = 0) => {
      const n = name(k);
      return `<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-size="12" fill="${n ? '#1e2843' : '#888'}" font-family="Jost, sans-serif" ${rot ? `transform="rotate(${rot} ${tx} ${ty})"` : ''}>${esc(n || 'cut')}</text>`;
    };
    diag.innerHTML = `<svg viewBox="0 0 400 ${y + h + 46}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#c9c8c4"/>
      ${edge('back', x, y, x + w, y)}${edge('front', x, y + h, x + w, y + h)}
      ${edge('left', x, y, x, y + h)}${edge('right', x + w, y, x + w, y + h)}
      <text x="200" y="${y + h / 2 + 5}" text-anchor="middle" font-size="14" fill="#4d4d4e" font-family="Jost, sans-serif">${L ? mm(L) : '—'} × ${W ? mm(W) : '—'}</text>
      ${lbl('back', 200, y - 10)}
      ${lbl('front', 200, y + h + 20)}
      <text x="200" y="${y + h + 38}" text-anchor="middle" font-size="10" fill="#888" letter-spacing="2" font-family="Jost, sans-serif">FRONT</text>
      ${lbl('left', x - 10, y + h / 2, 'middle', -90)}
      ${lbl('right', x + w + 14, y + h / 2, 'middle', 90)}
    </svg>`;
  }

  sels.forEach((s) => s.addEventListener('change', () => { state[s.dataset.side] = s.value; draw(); onChange?.({ ...state }); }));
  $$('[data-quick]', root).forEach((b) => b.addEventListener('click', () => {
    const def = finishes[0]?.id || '';
    const pick = (k) => state[k] || def;
    const q = b.dataset.quick;
    const next = {
      none: { front: '', back: '', left: '', right: '' },
      front: { front: pick('front'), back: '', left: '', right: '' },
      three: { front: pick('front'), back: '', left: pick('front'), right: pick('front') },
      all: { front: pick('front'), back: pick('front'), left: pick('front'), right: pick('front') },
    }[q];
    api.set(next); onChange?.({ ...state });
  }));

  const api = {
    get: () => ({ ...state }),
    set(v) { Object.assign(state, v); sels.forEach((s) => (s.value = state[s.dataset.side] || '')); draw(); },
    redraw(l, w) { L = l; W = w; draw(); },
  };
  draw();
  return api;
}
