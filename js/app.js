import { SETTINGS } from './config.js';
import { listOffcuts, listFinishes, submitEnquiry } from './data.js';
import { quote, compare, fits, money, SIDES } from './pricing.js';
import { $, $$, esc, mm, media, swatchSVG, edgePicker, mountChrome } from './ui.js';

mountChrome();
$('#hero-stone').innerHTML = swatchSVG({ id: 'hero-stone', name: 'Nero Assoluto', material: 'Granite' }, { w: 1600, h: 760 });

let OFFCUTS = [], FINISHES = [];
let finderEdges, detailEdges, current = null;

const debounce = (fn, ms = 180) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const area = (o) => (o.length_mm * o.width_mm) / 1e6;
const edgeSummary = (edges) => SIDES.filter((s) => edges[s.key]).map((s) => `${s.key} ${FINISHES.find((f) => f.id === edges[s.key])?.name}`).join(', ') || 'no finished edges';

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

  finderEdges = edgePicker($('#finder-edges'), FINISHES, { onChange: runFinder });
  detailEdges = edgePicker($('#d-edges'), FINISHES, { onChange: updateDetail });

  $$('#finder-form input, #finder-form select:not([data-side])').forEach((el) => el.addEventListener('input', debounce(runFinder)));
  $('#finder-form').addEventListener('submit', (e) => e.preventDefault());
  $$('#s-material, #s-sort').forEach((el) => el.addEventListener('change', renderStock));

  renderStock();
  renderFinishTable();
  runFinder();
}

// ---------- Finder ----------
function finderValues() {
  return { L: +$('#f-length').value || 0, W: +$('#f-width').value || 0, mat: $('#f-material').value, thick: $('#f-thick').value };
}
function runFinder() {
  const { L, W, mat, thick } = finderValues();
  finderEdges.redraw(L, W);
  const out = $('#results');
  if (!L || !W) {
    $('#results-count').textContent = '';
    out.innerHTML = `<div class="empty">Enter a length and depth to see which offcuts fit and what each would cost.</div>`;
    return;
  }
  const edges = finderEdges.get();
  const pool = OFFCUTS.filter((o) => (!mat || o.material === mat) && (!thick || String(o.thickness_mm) === thick));
  const list = compare(pool, L, W, edges, FINISHES);
  $('#results-count').textContent = `${list.length} of ${pool.length} offcut${pool.length === 1 ? '' : 's'} fit ${mm(L)} × ${mm(W)}`;
  if (!list.length) {
    const biggest = [...pool].sort((a, b) => Math.max(b.length_mm, b.width_mm) - Math.max(a.length_mm, a.width_mm))[0];
    out.innerHTML = `<div class="empty">Nothing in the yard is big enough for ${mm(L)} × ${mm(W)} right now.
      ${biggest ? `<br>Our longest piece is ${mm(biggest.length_mm)} × ${mm(biggest.width_mm)}.` : ''}
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
  $$('[data-open]', out).forEach((b) => b.addEventListener('click', () => openDetail(b.dataset.open, { L, W, edges })));
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
    <thead><tr><th>Finish</th><th>Price per metre</th></tr></thead>
    <tbody>
      <tr><td><strong>Unfinished (cut edge)</strong><br><span class="muted">For edges against a wall or unit</span></td><td>Free</td></tr>
      ${FINISHES.map((f) => `<tr><td><strong>${esc(f.name)}</strong>${f.description ? `<br><span class="muted">${esc(f.description)}</span>` : ''}</td><td>${money(f.price_per_m)}/m</td></tr>`).join('')}
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
  $('#d-length').value = preset?.L || '';
  $('#d-width').value = preset?.W || '';
  $('#d-length').placeholder = `up to ${o.length_mm}`;
  $('#d-width').placeholder = `up to ${o.width_mm}`;
  detailEdges.set(preset?.edges || { front: '', back: '', left: '', right: '' });
  $('#enquiry').innerHTML = $('#enquiry').dataset.form || $('#enquiry').innerHTML;
  bindEnquiry();
  updateDetail();
  openModal('#detail');
  $('.modal#detail .sheet').scrollTop = 0;
}
$('#enquiry').dataset.form = $('#enquiry').innerHTML;
$$('#d-length, #d-width').forEach((el) => el.addEventListener('input', debounce(updateDetail, 120)));

function updateDetail() {
  const o = current; if (!o) return;
  const L = +$('#d-length').value || 0, W = +$('#d-width').value || 0;
  detailEdges.redraw(L, W);
  const fitEl = $('#d-fit');
  const ok = L > 0 && W > 0 && fits(o, L, W);
  if (!L || !W) fitEl.textContent = `Enter the finished size you need from this ${mm(o.length_mm)} × ${mm(o.width_mm)} offcut.`;
  else if (!ok) fitEl.innerHTML = `<span class="error">That's too big for this offcut (max ${mm(o.length_mm - SETTINGS.cutAllowanceMm)} × ${mm(o.width_mm - SETTINGS.cutAllowanceMm)}). Try “Find your cut” to see pieces that fit.</span>`;
  else fitEl.textContent = `✓ Fits this offcut.`;

  const bd = $('#d-breakdown');
  const submit = $('#e-submit');
  if (!ok) { bd.innerHTML = ''; $('#d-note').textContent = ''; if (submit) submit.disabled = true; return; }
  const q = quote(o, L, W, detailEdges.get(), FINISHES);
  bd.innerHTML = `
    <tr><td>Stone · ${q.areaM2.toFixed(3)}m² × ${money(o.price_per_m2)}/m²</td><td>${money(q.stone)}</td></tr>
    ${q.edgeLines.map((e) => `<tr><td>${esc(e.sideLabel.split(' (')[0])} edge · ${esc(e.finish)} · ${e.metres.toFixed(2)}m × ${money(e.rate)}/m</td><td>${money(e.cost)}</td></tr>`).join('')}
    ${q.minApplied ? `<tr><td>Minimum charge applied</td><td></td></tr>` : ''}
    <tr class="total"><td>Total</td><td>${money(q.total)}</td></tr>`;
  $('#d-note').textContent = SETTINGS.priceNote;
  if (submit) submit.disabled = false;
}

function bindEnquiry() {
  const form = $('#e-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const o = current, L = +$('#d-length').value, W = +$('#d-width').value;
    const name = $('#e-name').value.trim(), email = $('#e-email').value.trim();
    const err = $('#e-error');
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Please add your name and a valid email.'; err.hidden = false; return; }
    if (!fits(o, L, W)) { err.textContent = 'Please enter a size that fits this offcut.'; err.hidden = false; return; }
    const edges = detailEdges.get();
    const q = quote(o, L, W, edges, FINISHES);
    const edgeNames = Object.fromEntries(SIDES.map((s) => [s.key, FINISHES.find((f) => f.id === edges[s.key])?.name || null]));
    const btn = $('#e-submit'); btn.disabled = true; btn.textContent = 'Sending…'; err.hidden = true;
    try {
      await submitEnquiry({
        offcut_id: o.id, offcut_ref: o.ref, customer_name: name, email,
        phone: $('#e-phone').value.trim() || null, length_mm: L, width_mm: W,
        edges: edgeNames, quoted_total: q.total, message: $('#e-msg').value.trim() || null,
      });
      const body = encodeURIComponent(`Offcut ${o.ref} – ${o.name} (${o.material}, ${o.thickness_mm}mm)\nPiece: ${L} x ${W}mm\nEdges: ${edgeSummary(edges)}\nQuoted: ${money(q.total)}\n\nName: ${name}\nPhone: ${$('#e-phone').value}`);
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
