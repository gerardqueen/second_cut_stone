import { DEMO_MODE } from './config.js';
import {
  currentAdmin, signIn, signOut, listOffcuts, saveOffcut, deleteOffcut, nextRef, uploadPhoto,
  listFinishes, saveFinish, deleteFinish, listEnquiries, setEnquiryHandled,
} from './data.js';
import { money } from './pricing.js';
import { $, $$, esc, mm, media, mountChrome } from './ui.js';

mountChrome({ admin: true });

let OFFCUTS = [], FINISHES = [], ENQ = [];
let pendingPhoto = null; // File waiting to upload on save

// ---------- Auth ----------
async function boot() {
  let who;
  try { who = await currentAdmin(); } catch (e) { who = null; console.error(e); }
  if (!who) return showLogin();
  if (who.notAdmin) return showLogin(`${who.email} isn't set up as an admin yet. Add this account's user ID to the admins table (see README).`);
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  $('#who').textContent = who.demo ? 'Demo mode — changes stay in this browser' : `Signed in as ${who.email}`;
  const so = $('[data-signout]');
  if (so && !who.demo) { so.hidden = false; so.onclick = async (e) => { e.preventDefault(); await signOut(); location.reload(); }; }
  await refreshAll();
  resetForm();
}
function showLogin(msg) {
  $('#login-view').hidden = false; $('#app-view').hidden = true;
  if (msg) { $('#l-error').textContent = msg; $('#l-error').hidden = false; }
}
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#l-error'); err.hidden = true;
  try { await signIn($('#l-email').value.trim(), $('#l-pass').value); await boot(); }
  catch (ex) { err.textContent = ex.message || 'Sign-in failed'; err.hidden = false; }
});

// ---------- Tabs ----------
$$('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  $$('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
  $$('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.tab));
}));

async function refreshAll() {
  [OFFCUTS, FINISHES, ENQ] = await Promise.all([
    listOffcuts({ includeSold: true }), listFinishes({ includeInactive: true }), listEnquiries(),
  ]);
  renderOffcuts(); renderFinishes(); renderEnquiries();
}

// ---------- Offcut form ----------
const form = $('#o-form');
function setPhotoPreview(src) {
  const drop = $('#o-photo-drop');
  $$('img', drop).forEach((i) => i.remove());
  $('#o-photo-hint').hidden = !!src;
  $('#o-photo-clear').hidden = !src;
  if (src) drop.insertAdjacentHTML('afterbegin', `<img src="${esc(src)}" alt="">`);
}
function onPhotoPicked(file) {
  if (!file) return;
  pendingPhoto = file;
  setPhotoPreview(URL.createObjectURL(file));
}
$('#o-photo').addEventListener('change', (e) => onPhotoPicked(e.target.files[0]));
$('#o-photo-library').addEventListener('click', () => {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = () => onPhotoPicked(i.files[0]); i.click();
});
$('#o-photo-clear').addEventListener('click', () => { pendingPhoto = null; $('#o-photo-url').value = ''; $('#o-photo').value = ''; setPhotoPreview(''); });

function updateArea() {
  const L = +$('#o-length').value, W = +$('#o-width').value, p = +$('#o-price').value;
  $('#o-area').textContent = L && W ? `${((L * W) / 1e6).toFixed(3)}m² — whole offcut worth ${money((L * W) / 1e6 * (p || 0))} at this rate` : '';
}
$$('#o-length, #o-width, #o-price').forEach((el) => el.addEventListener('input', updateArea));

async function resetForm() {
  form.reset();
  $('#o-id').value = ''; $('#o-photo-url').value = '';
  pendingPhoto = null; setPhotoPreview('');
  $('#o-form-title').textContent = 'Log an offcut';
  $('#o-save').textContent = 'Save offcut';
  $('#o-cancel').hidden = true;
  $('#o-error').hidden = true;
  $('#o-thick').value = '20';
  $('#o-ref').value = await nextRef();
  updateArea();
}
$('#o-cancel').addEventListener('click', resetForm);

function editOffcut(id) {
  const o = OFFCUTS.find((x) => x.id === id); if (!o) return;
  $('#o-id').value = o.id; $('#o-ref').value = o.ref || ''; $('#o-status').value = o.status;
  $('#o-material').value = o.material; $('#o-name').value = o.name;
  $('#o-length').value = o.length_mm; $('#o-width').value = o.width_mm;
  if (![...$('#o-thick').options].some((op) => op.value === String(o.thickness_mm))) $('#o-thick').insertAdjacentHTML('beforeend', `<option>${o.thickness_mm}</option>`);
  $('#o-thick').value = String(o.thickness_mm);
  $('#o-price').value = o.price_per_m2; $('#o-notes').value = o.notes || '';
  $('#o-photo-url').value = o.photo_url || ''; pendingPhoto = null; setPhotoPreview(o.photo_url || '');
  $('#o-form-title').textContent = `Edit ${o.ref || o.name}`;
  $('#o-save').textContent = 'Update offcut';
  $('#o-cancel').hidden = false;
  updateArea();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#o-error'); err.hidden = true;
  const v = {
    id: $('#o-id').value || undefined, ref: $('#o-ref').value.trim(), status: $('#o-status').value,
    material: $('#o-material').value.trim(), name: $('#o-name').value.trim(),
    length_mm: +$('#o-length').value, width_mm: +$('#o-width').value, thickness_mm: +$('#o-thick').value,
    price_per_m2: +$('#o-price').value, notes: $('#o-notes').value.trim(), photo_url: $('#o-photo-url').value,
  };
  if (!v.material || !v.name || !v.length_mm || !v.width_mm || !(v.price_per_m2 >= 0) || $('#o-price').value === '') {
    err.textContent = 'Material, name, length, width and price are all needed.'; err.hidden = false; return;
  }
  // Store the longer side as length so sizes read consistently.
  if (v.width_mm > v.length_mm) [v.length_mm, v.width_mm] = [v.width_mm, v.length_mm];
  const btn = $('#o-save'); btn.disabled = true; const label = btn.textContent;
  try {
    if (pendingPhoto) { btn.textContent = 'Uploading photo…'; v.photo_url = await uploadPhoto(pendingPhoto); }
    btn.textContent = 'Saving…';
    await saveOffcut(v);
    await refreshAll();
    await resetForm();
  } catch (ex) {
    console.error(ex); err.textContent = ex.message || 'Save failed'; err.hidden = false;
  } finally { btn.disabled = false; if (btn.textContent.endsWith('…')) btn.textContent = label; }
});

// ---------- Offcut table ----------
$('#o-search').addEventListener('input', renderOffcuts);
$('#o-filter').addEventListener('change', renderOffcuts);

function renderOffcuts() {
  const q = $('#o-search').value.toLowerCase(), st = $('#o-filter').value;
  const rows = OFFCUTS.filter((o) => (!st || o.status === st) && (!q || `${o.ref} ${o.name} ${o.material}`.toLowerCase().includes(q)));
  $('#o-count').textContent = `${rows.length} shown · ${OFFCUTS.filter((o) => o.status === 'available').length} available`;
  $('#o-table').innerHTML = `
    <thead><tr><th></th><th>Ref</th><th>Stone</th><th>Size</th><th>£/m²</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows.map((o) => `
      <tr>
        <td><div class="mini" style="overflow:hidden">${media(o)}</div></td>
        <td>${esc(o.ref || '—')}</td>
        <td><strong style="font-weight:400">${esc(o.name)}</strong><br><span class="muted">${esc(o.material)} · ${o.thickness_mm}mm</span></td>
        <td style="white-space:nowrap">${mm(o.length_mm)} × ${mm(o.width_mm)}</td>
        <td>${money(o.price_per_m2)}</td>
        <td><select class="status-select" data-status="${esc(o.id)}">
          ${['available', 'reserved', 'sold'].map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
        </select></td>
        <td><div class="inline-actions">
          <button class="btn small ghost" data-edit="${esc(o.id)}">Edit</button>
          <button class="btn small ghost" data-del="${esc(o.id)}">Delete</button>
        </div></td>
      </tr>`).join('') || `<tr><td colspan="7" class="muted">No offcuts yet — log your first one on the left.</td></tr>`}
    </tbody>`;
  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => editOffcut(b.dataset.edit)));
  $$('[data-status]').forEach((s) => s.addEventListener('change', async () => {
    const o = OFFCUTS.find((x) => x.id === s.dataset.status);
    await saveOffcut({ ...o, status: s.value }); await refreshAll();
  }));
  armDelete('[data-del]', async (id) => { await deleteOffcut(id); await refreshAll(); });
}

/** Two-tap delete (no browser pop-ups). */
function armDelete(sel, fn) {
  $$(sel).forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.armed) { b.disabled = true; await fn(b.dataset.del || b.dataset.fdel); return; }
    b.dataset.armed = '1'; b.textContent = 'Tap again to delete';
    setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'Delete'; } }, 3500);
  }));
}

// ---------- Edge finishes ----------
function renderFinishes() {
  $('#f-table').innerHTML = `
    <thead><tr><th>Order</th><th>Name</th><th>Description</th><th>£ per metre</th><th>Active</th><th></th></tr></thead>
    <tbody>${FINISHES.map((f) => `
      <tr data-fid="${esc(f.id)}">
        <td><input type="number" value="${f.sort ?? 0}" data-k="sort" style="width:64px" class="status-select"></td>
        <td><input value="${esc(f.name)}" data-k="name" class="status-select" style="width:100%;min-width:140px"></td>
        <td><input value="${esc(f.description || '')}" data-k="description" class="status-select" style="width:100%;min-width:200px"></td>
        <td><input type="number" step="0.01" value="${f.price_per_m}" data-k="price_per_m" style="width:96px" class="status-select"></td>
        <td><input type="checkbox" data-k="active" ${f.active ? 'checked' : ''}></td>
        <td><div class="inline-actions">
          <button class="btn small" data-fsave="${esc(f.id)}">Save</button>
          <button class="btn small ghost" data-fdel="${esc(f.id)}">Delete</button>
        </div></td>
      </tr>`).join('')}
    </tbody>`;
  $$('[data-fsave]').forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('tr'), get = (k) => $(`[data-k="${k}"]`, tr);
    b.disabled = true; b.textContent = 'Saving…';
    try {
      await saveFinish({ id: b.dataset.fsave, name: get('name').value.trim(), description: get('description').value.trim(),
        price_per_m: +get('price_per_m').value, sort: +get('sort').value, active: get('active').checked });
      await refreshAll();
    } catch (ex) { alertRow(tr, ex); b.disabled = false; b.textContent = 'Save'; }
  }));
  armDelete('[data-fdel]', async (id) => { await deleteFinish(id); await refreshAll(); });
}
function alertRow(tr, ex) { tr.insertAdjacentHTML('afterend', `<tr><td colspan="6" class="error">${esc(ex.message || ex)}</td></tr>`); }
$('#f-add').addEventListener('click', async () => {
  await saveFinish({ name: 'New finish', description: '', price_per_m: 0, sort: FINISHES.length + 1, active: false });
  await refreshAll();
});

// ---------- Enquiries ----------
function renderEnquiries() {
  const open = ENQ.filter((e) => !e.handled).length;
  $('#enq-badge').innerHTML = open ? `<span class="tag">${open}</span>` : '';
  $('#q-table').innerHTML = `
    <thead><tr><th>When</th><th>Customer</th><th>Offcut</th><th>Piece</th><th>Edges</th><th>Quoted</th><th>Done</th></tr></thead>
    <tbody>${ENQ.map((e) => {
      const edges = Object.entries(e.edges || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${esc(v)}`).join('<br>') || '<span class="muted">none</span>';
      return `<tr style="${e.handled ? 'opacity:.55' : ''}">
        <td style="white-space:nowrap">${new Date(e.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td>${esc(e.customer_name)}<br><a href="mailto:${esc(e.email)}">${esc(e.email)}</a>${e.phone ? `<br><a href="tel:${esc(e.phone)}">${esc(e.phone)}</a>` : ''}
          ${e.message ? `<br><span class="muted">“${esc(e.message)}”</span>` : ''}</td>
        <td>${esc(e.offcut_ref || '—')}</td>
        <td style="white-space:nowrap">${mm(e.length_mm)} × ${mm(e.width_mm)}</td>
        <td>${edges}</td>
        <td>${money(e.quoted_total)}</td>
        <td><input type="checkbox" data-handled="${esc(e.id)}" ${e.handled ? 'checked' : ''}></td>
      </tr>`;
    }).join('') || `<tr><td colspan="7" class="muted">No enquiries yet.</td></tr>`}</tbody>`;
  $$('[data-handled]').forEach((c) => c.addEventListener('change', async () => { await setEnquiryHandled(c.dataset.handled, c.checked); await refreshAll(); }));
}

if (DEMO_MODE) console.info('Second Cut Stone admin running in demo mode.');
boot();
