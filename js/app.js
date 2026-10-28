import { SETTINGS } from './config.js';
import { listOffcuts, listFinishes, submitEnquiry } from './data.js';
import { quote, compare, fits, money } from './pricing.js';
import { SHAPES } from './shapes.js';
import { $, $$, esc, mm, media, swatchSVG, pieceBuilder, mountChrome } from './ui.js';
import { profileSVG, profileOf } from './profiles.js';

mountChrome();
$('#hero-stone').innerHTML = swatchSVG({ id: 'hero-stone', name: 'Nero Assoluto', material: 'Granite' }, { w: 1600, h: 760 });

let OFFCUTS = [], FINISHES = [];
let finder, detail, current = null;

const debounce = (fn, ms = 180) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const area = (o) => (o.length_mm * o.width_mm) / 1e6;

async function init() {
  try {
    [OFFCUTS, FINISHES] = await Promise.all([listOffcuts(), listFinishes()]);
  } catch (e) {
    console.error(e);
    $('#results').innerHTML = `<div class="empty">Couldn't load stock right now. Please call ${esc(SETTINGS.contact.phone)}.</div>`;
    return;
  }
  OFFCUTS = OFFCUTS.filter((o) => o.status !== 'sold');
  $('#price-note').textContent = SETTINGS.priceNote;

  // filter dropdowns
  const mats = [...new Set(OFFCUTS.map((o) => o.material))].sort();
  const thicks = [...new Set(OFFCUTS.map((o) => o.thickness_mm))].sort((a, b) => a - b);
  for (const id of ['#f-material', '#s-material']) $(id).insertAdjacentHTML('beforeend', mats.map((m) => `<option>${esc(m)}</option>`).join(''));
  $('#f-thick').insertAdjacentHTML('beforeend', thicks.map((t) => `<option value="${t}">${t}mm</option>`).join(''));

  finder = pieceBuilder($('#finder-builder'), FINISHES, { onChange: debounce(runFinder), idPrefix: 'f' });
  detail = pieceBuilder($('#d-builder'), FINISHES, { onChange: debounce(updateDetail, 120), idPrefix: 'd' });
  if (SETTINGS.shapedPieceCharge === 'shape') $('#stone-rule').textContent = "Area of the finished shape (m²) × the offcut's £/m².";

  $$('#f-material, #f-thick').forEach((el) => el.addEventListener('change', runFinder));
  $('#finder-form').addEventListener('submit', (e) => e.preventDefault());
  $$('#s-material, #s-sort').forEach((el) => el.addEventListener('change', renderStock));

  renderStock();
  renderFinishTable();
  runFinder();
  openFromLink();
}

// ---------- Finder ----------
function runFinder() {
  const st = finder.get(), piece = st.piece;
  const mat = $('#f-material').value, thick = $('#f-thick').value;
  const out = $('#results');
  if (!piece.valid) {
    $('#results-count').textContent = '';
    out.innerHTML = `<div class="empty">${piece.error ? esc(piece.error) : 'Pick a shape and enter its measurements to see which offcuts fit and what each would cost.'}</div>`;
    return;
  }
  const pool = OFFCUTS.filter((o) => (!mat || o.material === mat) && (!thick || String(o.thickness_mm) === thick));
  const list = compare(pool, piece, st.edges, FINISHES);
  $('#results-count').textContent = `${list.length} of ${pool.length} offcut${pool.length === 1 ? '' : 's'} fit · ${piece.summary}`;
  if (!list.length) {
    const biggest = [...pool].sort((a, b) => b.length_mm * b.width_mm - a.length_mm * a.width_mm)[0];
    out.innerHTML = `<div class="empty">Nothing in the yard is big enough for this piece right now (it needs ${mm(Math.round(piece.bboxL))} × ${mm(Math.round(piece.bboxW))} of stone).
      ${biggest ? `<br>Our largest offcut is ${mm(biggest.length_mm)} × ${mm(biggest.width_mm)}.` : ''}
      <br><br>Call <a href="tel:${SETTINGS.contact.phone.replace(/\s/g, '')}">${esc(SETTINGS.contact.phone)}</a> — new offcuts come in every week, or Granite Systems can quote from a full slab.</div>`;
    return;
  }
  out.innerHTML = list.map(({ offcut: o, q }, i) => `
    <article class="result${i === 0 ? ' best' : ''}">
      <div class="thumb">${media(o)}</div>
      <div>
        <h4>${esc(o.name)}${i === 0 ? '<span class="tag">Best price</span>' : ''}${o.status === 'reserved' ? '<span class="tag warn">Reserved</span>' : ''}</h4>
        <div class="meta">${esc(o.material)} · ${o.thickness_mm}mm · ${esc(o.ref || '')}</div>
        <div class="meta">Offcut ${mm(o.length_mm)} × ${mm(o.width_mm)} · ${money(o.price_per_m2)}/m²</div>
        <div class="meta">Stone ${money(q.stone)}${q.edgeTotal ? ` + edges ${money(q.edgeTotal)}` : ''}${q.minApplied ? ' · minimum charge applies' : ''}</div>
      </div>
      <div class="price">
        <strong>${money(q.total)}</strong>
        <button class="btn small" data-open="${esc(o.id)}">Select</button>
      </div>
    </article>`).join('');
  $$('[data-open]', out).forEach((b) => b.addEventListener('click', () => openDetail(b.dataset.open, finder.get())));
}

// ---------- Stock grid ----------
function renderStock() {
  const mat = $('#s-material').value, sort = $('#s-sort').value;
  let list = OFFCUTS.filter((o) => !mat || o.material === mat);
  if (sort === 'price') list = [...list].sort((a, b) => a.price_per_m2 - b.price_per_m2);
  if (sort === 'size') list = [...list].sort((a, b) => area(b) - area(a));
  $('#stock-count').textContent = `${list.length} offcut${list.length === 1 ? '' : 's'}`;
  const grid = $('#stock-grid');
  if (!list.length) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1">No offcuts listed at the moment — check back soon.</div>`; return; }
  grid.innerHTML = list.map((o) => `
    <article class="card">
      <div class="photo" data-zoom="${esc(o.id)}">${media(o)}
        ${o.ref ? `<span class="ref">${esc(o.ref)}</span>` : ''}
        ${o.status === 'reserved' ? '<span class="status tag warn">Reserved</span>' : ''}
      </div>
      <div class="body">
        <div class="material">${esc(o.material)}</div>
        <h3>${esc(o.name)}</h3>
        <div class="specs"><span>${mm(o.length_mm)} × ${mm(o.width_mm)}</span><span>${o.thickness_mm}mm thick</span><span>${area(o).toFixed(2)}m²</span></div>
        ${o.notes ? `<p class="note" style="margin:4px 0 0">${esc(o.notes)}</p>` : ''}
        <div class="foot">
          <div class="rate"><strong>${money(o.price_per_m2)}</strong> <span>/m²</span></div>
          <button class="btn small" data-open="${esc(o.id)}" ${o.status === 'reserved' ? 'disabled' : ''}>Price it</button>
        </div>
      </div>
    </article>`).join('');
  $$('[data-open]', grid).forEach((b) => b.addEventListener('click', () => openDetail(b.dataset.open)));
  $$('[data-zoom]', grid).forEach((p) => p.addEventListener('click', () => {
    const o = OFFCUTS.find((x) => x.id === p.dataset.zoom);
    $('#lb-img').innerHTML = media(o, { w: 1200, h: 900 });
    openModal('#lightbox');
  }));
}

function renderFinishTable() {
  $('#finish-table').innerHTML = `
    <thead><tr><th></th><th>Finish</th><th>Price per metre</th></tr></thead>
    <tbody>
      <tr><td class="profile-cell">${profileSVG('sawn', { size: 64 })}</td><td><strong>Unfinished (cut edge)</strong><br><span class="muted">For edges against a wall or unit</span></td><td>Free</td></tr>
      ${FINISHES.map((f) => `<tr><td class="profile-cell">${profileSVG(profileOf(f), { size: 64 })}</td><td><strong>${esc(f.name)}</strong>${f.description ? `<br><span class="muted">${esc(f.description)}</span>` : ''}</td><td>${money(f.price_per_m)}/m</td></tr>`).join('')}
    </tbody>`;
}

// ---------- Detail modal ----------
function openModal(sel) { $(sel).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModals() { $$('.modal.open').forEach((m) => m.classList.remove('open')); document.body.style.overflow = ''; }
$$('[data-close]').forEach((el) => el.addEventListener('click', closeModals));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

function openDetail(id, preset) {
  const o = OFFCUTS.find((x) => x.id === id);
  if (!o) return;
  current = o;
  $('#d-media').innerHTML = media(o, { w: 600, h: 800 });
  $('#d-material').textContent = `${o.material} · ${o.ref || ''}`;
  $('#d-title').textContent = o.name;
  $('#d-specs').innerHTML = `<span>Offcut ${mm(o.length_mm)} × ${mm(o.width_mm)}</span><span>${o.thickness_mm}mm thick</span><span>${money(o.price_per_m2)}/m²</span>`;
  $('#d-notes').textContent = o.notes || '';
  detail.set(preset || { shape: 'rectangle', dims: {}, edges: {} });
  $('#enquiry').innerHTML = $('#enquiry').dataset.form || $('#enquiry').innerHTML;
  bindEnquiry();
  updateDetail();
  openModal('#detail');
  $('.modal#detail .sheet').scrollTop = 0;
}
$('#enquiry').dataset.form = $('#enquiry').innerHTML;

function updateDetail() {
  const o = current; if (!o || !detail) return;
  const st = detail.get(), piece = st.piece;
  const fitEl = $('#d-fit');
  const ok = fits(o, piece);
  const a = SETTINGS.cutAllowanceMm || 0;
  if (!piece.valid) fitEl.textContent = piece.error || `Choose a shape and enter the finished size you need from this ${mm(o.length_mm)} × ${mm(o.width_mm)} offcut.`;
  else if (!ok) fitEl.innerHTML = `<span class="error">Too big for this offcut: the piece needs ${mm(Math.round(piece.bboxL))} × ${mm(Math.round(piece.bboxW))} and the most this offcut gives is ${mm(o.length_mm - a)} × ${mm(o.width_mm - a)}. Try “Find your cut” to see pieces that fit.</span>`;
  else fitEl.textContent = `✓ Fits this offcut.`;

  const bd = $('#d-breakdown');
  const submit = $('#e-submit');
  if (!ok) { bd.innerHTML = ''; $('#d-note').textContent = ''; $('#d-ar').hidden = true; if (submit) submit.disabled = true; return; }
  const q = quote(o, piece, st.edges, FINISHES);
  const stoneLine = q.chargeBlock
    ? `Stone · cut from ${mm(Math.round(piece.bboxL))} × ${mm(Math.round(piece.bboxW))} (${q.chargedM2.toFixed(3)}m²) × ${money(o.price_per_m2)}/m²`
    : `Stone · ${q.chargedM2.toFixed(3)}m² × ${money(o.price_per_m2)}/m²`;
  bd.innerHTML = `
    <tr><td>${esc(piece.summary)}</td><td></td></tr>
    <tr><td>${stoneLine}</td><td>${money(q.stone)}</td></tr>
    ${q.edgeLines.map((e) => `<tr><td>${esc(e.label)} · ${esc(e.finish)} · ${e.metres.toFixed(2)}m × ${money(e.rate)}/m</td><td>${money(e.cost)}</td></tr>`).join('')}
    ${q.minApplied ? `<tr><td>Minimum charge applied</td><td></td></tr>` : ''}
    <tr class="total"><td>Total</td><td>${money(q.total)}</td></tr>`;
  $('#d-note').textContent = SETTINGS.priceNote;
  if (submit) submit.disabled = false;
  $('#d-ar').hidden = false;
}

// ---------- View in your room (AR pilot) ----------
// Every shape works. A shared link (the desktop QR code) carries the shape and its measurements:
//   ?ar=<offcut id>&s=<shape>&<dimension>=<mm>…[&h=left|right]
// Older links using ?ar=…&l=<mm>&w=<mm> still open as a rectangle.
async function openAR(o, st) {
  const share = new URL(location.href.split('#')[0].split('?')[0]);
  const params = { ar: o.id, s: st.shape };
  for (const [k, v] of Object.entries(st.dims)) if (Number(v) > 0) params[k] = Math.round(v);
  if (st.shape === 'lshape') params.h = st.hand;
  share.search = new URLSearchParams(params).toString();
  $('#ar').classList.add('open'); document.body.style.overflow = 'hidden';
  const { showInRoom } = await import('./ar.js');
  showInRoom($('#ar-host'), o, st.piece, share.toString(), st);
}
function closeAR() {
  $('#ar').classList.remove('open');
  $('#ar-host').innerHTML = '';
  if (!$('#detail').classList.contains('open')) document.body.style.overflow = '';
}
$$('[data-close-ar]').forEach((el) => el.addEventListener('click', closeAR));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#ar').classList.contains('open')) { e.stopImmediatePropagation(); closeAR(); } }, true);
$('#d-ar-btn').addEventListener('click', () => {
  const st = detail.get();
  if (current && fits(current, st.piece)) openAR(current, st);
});

function openFromLink() {
  const p = new URLSearchParams(location.search);
  const o = OFFCUTS.find((x) => x.id === p.get('ar'));
  if (!o) return;
  let preset;
  if (p.get('s') && SHAPES[p.get('s')]) {
    const shape = p.get('s');
    const dims = Object.fromEntries(SHAPES[shape].fields.map((f) => [f.key, +p.get(f.key) || 0]));
    preset = { shape, dims, hand: p.get('h') === 'right' ? 'right' : 'left', edges: {} };
  } else if (+p.get('l') > 0 && +p.get('w') > 0) {
    preset = { shape: 'rectangle', dims: { length: +p.get('l'), width: +p.get('w') }, edges: {} };
  } else return;
  openDetail(o.id, preset);
  const st = detail.get();
  if (fits(o, st.piece)) openAR(o, st);
}

function bindEnquiry() {
  const form = $('#e-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const o = current, st = detail.get(), piece = st.piece;
    const name = $('#e-name').value.trim(), email = $('#e-email').value.trim();
    const err = $('#e-error');
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Please add your name and a valid email.'; err.hidden = false; return; }
    if (!fits(o, piece)) { err.textContent = 'Please enter a size that fits this offcut.'; err.hidden = false; return; }
    const q = quote(o, piece, st.edges, FINISHES);
    const desc = detail.describe();
    const edgeNames = Object.fromEntries(piece.edges.map((ed) => [ed.label, FINISHES.find((f) => f.id === st.edges[ed.key])?.name || null]));
    const btn = $('#e-submit'); btn.disabled = true; btn.textContent = 'Sending…'; err.hidden = true;
    try {
      await submitEnquiry({
        offcut_id: o.id, offcut_ref: o.ref, customer_name: name, email,
        phone: $('#e-phone').value.trim() || null,
        length_mm: Math.round(piece.bboxL), width_mm: Math.round(piece.bboxW),
        shape: st.shape, dims: { ...st.dims, hand: st.shape === 'lshape' ? st.hand : undefined, summary: piece.summary },
        edges: edgeNames, quoted_total: q.total, message: $('#e-msg').value.trim() || null,
      });
      const body = encodeURIComponent(`Offcut ${o.ref} – ${o.name} (${o.material}, ${o.thickness_mm}mm)\nPiece: ${desc.summary}\nEdges: ${desc.edges}\nQuoted: ${money(q.total)}\n\nName: ${name}\nPhone: ${$('#e-phone').value}`);
      $('#enquiry').innerHTML = `<div class="success" style="margin-top:22px"><strong>Thanks ${esc(name.split(' ')[0])} — request sent.</strong><br>
        We'll check the stone and get back to you to confirm your ${money(q.total)} quote for ${esc(o.ref)}.
        <br><span class="note">Prefer email? <a href="mailto:${esc(SETTINGS.contact.email)}?subject=${encodeURIComponent('Offcut request ' + (o.ref || ''))}&body=${body}">Send a copy to us</a>.</span></div>`;
    } catch (ex) {
      console.error(ex);
      err.textContent = `Sorry, that didn't send. Please call ${SETTINGS.contact.phone} or email ${SETTINGS.contact.email}.`;
      err.hidden = false; btn.disabled = false; btn.textContent = 'Send request';
    }
  });
}

init();
