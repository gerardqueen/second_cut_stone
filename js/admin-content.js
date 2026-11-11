// Admin → Site content: overview of the site's sections, edit wording, upload images, preview.
import { SECTIONS, FIELDS, originalFrom, safeImage } from './content.js';
import { getSiteContent, saveSiteContent, siteContentReady, uploadSiteImage } from './data.js';
import { $, $$, esc, swatchSVG } from './ui.js';
import { logoSVG } from './logo.js';

let SAVED = {}, ORIGINAL = {}, started = false;
const pendingImage = {}; // key -> uploaded URL waiting to be saved ('' = back to original)

const limits = { text: 200, textarea: 1000, lines: 600 };
const norm = (f, v) => (f.type === 'lines'
  ? String(v || '').split('\n').map((s) => s.trim()).filter(Boolean).join('\n')
  : String(v || '').trim());

function originalImage(key) {
  if (key === 'hero.image') return swatchSVG({ id: 'hero-stone', name: 'Nero Assoluto', material: 'Granite' }, { w: 800, h: 380 });
  if (key === 'brand.logo') return logoSVG();
  return '';
}
const imageHTML = (key, url) => (url ? `<img src="${esc(url)}" alt="">` : originalImage(key));

/** The value currently in the editor for a field. */
function editorValue(f) {
  if (f.type === 'image') return f.key in pendingImage ? pendingImage[f.key] : (SAVED[f.key] || '');
  return norm(f, $(`[data-ckey="${f.key}"]`)?.value);
}
/** What saving this field would change: undefined = nothing, null = back to original, string = new value. */
function changeFor(f) {
  const v = editorValue(f), saved = SAVED[f.key] || '';
  if (f.type === 'image') return v === saved ? undefined : (v || null);
  if (v === '' || v === norm(f, ORIGINAL[f.key])) return saved ? null : undefined;
  return v === saved ? undefined : v;
}
const isCustom = (f) => !!SAVED[f.key];

export async function initSiteContent() {
  if (started) return refresh();
  started = true;
  const host = $('#c-sections');
  host.innerHTML = '<p class="muted">Loading the site…</p>';
  try {
    const html = await fetch('./index.html', { cache: 'no-store' }).then((r) => r.text());
    const doc = new DOMParser().parseFromString(html, 'text/html');
    FIELDS.forEach((f) => (ORIGINAL[f.key] = originalFrom(doc, f)));
  } catch { FIELDS.forEach((f) => (ORIGINAL[f.key] = f.default ?? '')); }
  const ready = await siteContentReady();
  $('#c-setup').hidden = ready;
  $('#c-setup').textContent = ready ? '' : 'Saving is switched off until the site content table is set up (supabase/007_site_content.sql). You can look around, but changes won\'t save yet.';
  await refresh();
  window.addEventListener('beforeunload', (e) => { if (dirtyCount()) { e.preventDefault(); e.returnValue = ''; } });
}

async function refresh() {
  SAVED = await getSiteContent().catch(() => ({}));
  Object.keys(pendingImage).forEach((k) => delete pendingImage[k]);
  render();
}

function dirtyCount(sectionId) {
  return FIELDS.filter((f) => (!sectionId || f.section === sectionId) && changeFor(f) !== undefined).length;
}

function renderNav() {
  $('#c-nav').innerHTML = SECTIONS.map((s) => {
    const custom = s.fields.filter(isCustom).length, dirty = dirtyCount(s.id);
    return `<a href="#c-sec-${s.id}" class="c-chip" data-goto="${s.id}">
      <strong>${esc(s.title)}</strong>
      <span>${dirty ? `<em>${dirty} unsaved</em>` : custom ? `${custom} changed` : 'Original'}</span>
    </a>`;
  }).join('');
  $$('[data-goto]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); $(`#c-sec-${a.dataset.goto}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

function fieldHTML(f) {
  const custom = isCustom(f);
  const head = `<div class="c-field-head">
      <label for="c-${f.key}">${esc(f.label)}</label>
      ${custom ? '<span class="tag grey">Changed</span>' : ''}
      <a href="#" class="c-reset" data-reset="${f.key}" ${custom ? '' : 'hidden'}>Use original</a>
    </div>${f.help ? `<p class="hint" style="margin:0 0 6px">${esc(f.help)}</p>` : ''}`;
  if (f.type === 'image') {
    return `<div class="c-field" data-field="${f.key}">${head}
      <div class="c-image ${f.key === 'brand.logo' ? 'logo' : ''}" data-preview="${f.key}">${imageHTML(f.key, safeImage(SAVED[f.key]))}</div>
      <div class="inline-actions" style="margin-top:8px">
        <label class="btn small ghost c-upload">Upload new image<input type="file" accept="image/*" data-upload="${f.key}" hidden></label>
        <span class="muted" data-upstatus="${f.key}"></span>
      </div>
    </div>`;
  }
  const val = SAVED[f.key] || ORIGINAL[f.key] || '';
  const input = f.type === 'text'
    ? `<input id="c-${f.key}" data-ckey="${f.key}" maxlength="${limits.text}" value="${esc(val)}">`
    : `<textarea id="c-${f.key}" data-ckey="${f.key}" maxlength="${limits[f.type]}" rows="${f.type === 'lines' ? 6 : 3}">${esc(val)}</textarea>`;
  const orig = custom && ORIGINAL[f.key] ? `<details class="c-orig"><summary>Original wording</summary><p>${esc(ORIGINAL[f.key]).replace(/\n/g, '<br>')}</p></details>` : '';
  return `<div class="c-field" data-field="${f.key}">${head}${input}${orig}</div>`;
}

const cardHTML = (s) => `
    <section class="panel c-card" id="c-sec-${s.id}" data-section="${s.id}">
      <div class="c-card-head"><h3>${esc(s.title)}</h3><p class="muted">${esc(s.where)}</p></div>
      ${s.fields.map(fieldHTML).join('')}
      <div class="c-card-foot">
        <button class="btn small" data-csave="${s.id}" disabled>Save changes</button>
        <span class="muted" data-cstatus="${s.id}"></span>
      </div>
    </section>`;

function render() {
  renderNav();
  $('#c-sections').innerHTML = SECTIONS.map(cardHTML).join('');
  SECTIONS.forEach((s) => bindCard(s.id));
}

/** Redraw one section only, so unsaved edits elsewhere are kept. */
function renderCard(sectionId) {
  const s = SECTIONS.find((x) => x.id === sectionId);
  $(`#c-sec-${sectionId}`).outerHTML = cardHTML(s);
  bindCard(sectionId);
  renderNav();
}

function bindCard(sectionId) {
  const root = $(`#c-sec-${sectionId}`);
  const q = (sel) => [...root.querySelectorAll(sel)];
  q('[data-ckey]').forEach((el) => el.addEventListener('input', () => markDirty(sectionId)));
  q('[data-reset]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const f = FIELDS.find((x) => x.key === a.dataset.reset);
    if (f.type === 'image') { pendingImage[f.key] = ''; $(`[data-preview="${f.key}"]`).innerHTML = imageHTML(f.key, ''); }
    else $(`[data-ckey="${f.key}"]`).value = ORIGINAL[f.key] || '';
    markDirty(sectionId);
  }));
  q('[data-upload]').forEach((inp) => inp.addEventListener('change', async () => {
    const file = inp.files[0]; if (!file) return;
    const key = inp.dataset.upload, st = $(`[data-upstatus="${key}"]`);
    st.textContent = 'Uploading…'; st.classList.remove('error');
    try {
      const url = await uploadSiteImage(file, key === 'brand.logo' ? 800 : 2400);
      pendingImage[key] = url;
      $(`[data-preview="${key}"]`).innerHTML = imageHTML(key, url);
      st.textContent = 'Uploaded. Press Save changes to put it live.';
      markDirty(sectionId);
    } catch (ex) { st.textContent = ex.message || 'Upload failed'; st.classList.add('error'); }
    inp.value = '';
  }));
  q('[data-csave]').forEach((b) => b.addEventListener('click', () => saveSection(sectionId)));
}

function markDirty(sectionId) {
  const n = dirtyCount(sectionId);
  const btn = $(`[data-csave="${sectionId}"]`);
  btn.disabled = n === 0;
  $(`[data-cstatus="${sectionId}"]`).textContent = n ? `${n} unsaved change${n === 1 ? '' : 's'}` : '';
  $$(`[data-section="${sectionId}"] [data-reset]`).forEach((a) => {
    const f = FIELDS.find((x) => x.key === a.dataset.reset);
    const showsOriginal = f.type === 'image' ? !editorValue(f) : editorValue(f) === norm(f, ORIGINAL[f.key]);
    a.hidden = showsOriginal;
  });
  renderNav();
}

async function saveSection(sectionId) {
  const changes = {};
  FIELDS.filter((f) => f.section === sectionId).forEach((f) => {
    const c = changeFor(f); if (c !== undefined) changes[f.key] = c;
  });
  if (!Object.keys(changes).length) return;
  const btn = $(`[data-csave="${sectionId}"]`), st = $(`[data-cstatus="${sectionId}"]`);
  btn.disabled = true; btn.textContent = 'Saving…'; st.classList.remove('error');
  try {
    await saveSiteContent(changes);
    SAVED = await getSiteContent().catch(() => ({ ...SAVED, ...changes }));
    FIELDS.filter((f) => f.section === sectionId).forEach((f) => delete pendingImage[f.key]);
    renderCard(sectionId);
    const st2 = $(`[data-cstatus="${sectionId}"]`);
    st2.textContent = 'Saved. Live on the site now.'; st2.classList.add('ok');
    reloadPreview(sectionId);
  } catch (ex) {
    st.textContent = ex.message || 'Could not save'; st.classList.add('error');
    btn.disabled = false; btn.textContent = 'Save changes';
  }
}

const anchors = { hero: '', finder: '#finder', stock: '#stock', pricing: '#pricing', footer: '#contact', seo: '' };
function reloadPreview(sectionId) {
  const fr = $('#c-preview'); if (!fr) return;
  fr.src = `./?preview=${Date.now()}${anchors[sectionId] ?? ''}`;
}
