// Data layer: Supabase when configured, otherwise a browser-only demo store.
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEMO_MODE } from './config.js';

let sb = null;
async function client() {
  if (DEMO_MODE) return null;
  if (!sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return sb;
}
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

// ---------------- Demo store ----------------
const DEMO_KEY = 'scs-demo-v2';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
function seed() {
  const f = (name, description, price_per_m, sort, profile) => ({ id: uid(), name, description, price_per_m, sort, active: true, profile });
  const o = (ref, material, name, length_mm, width_mm, price_per_m2, thickness_mm = 20, notes = '') =>
    ({ id: uid(), ref, material, name, length_mm, width_mm, price_per_m2, thickness_mm, notes, photo_url: '', status: 'available', created_at: new Date().toISOString() });
  return {
    finishes: [
      f('Pencil round', 'Softly rounded top and bottom arris', 25, 1, 'pencil'),
      f('Square polished', 'Crisp square edge, polished face', 30, 2, 'square'),
      f('Bevelled', '45° chamfer along the top edge', 40, 3, 'bevel'),
      f('Bullnose', 'Fully rounded half-circle profile', 55, 4, 'bullnose'),
      f('Ogee', 'Decorative S-curve profile', 75, 5, 'ogee'),
    ],
    offcuts: [
      o('SC-001', 'Granite', 'Nero Assoluto', 1450, 620, 180, 30, 'Polished black, no visible flaws'),
      o('SC-002', 'Quartz', 'Calacatta Gold', 1100, 600, 220, 20),
      o('SC-003', 'Granite', 'Bianco Antico', 900, 640, 160, 30, 'Small chip on one corner'),
      o('SC-004', 'Quartz', 'Concrete Grey', 1820, 420, 195, 20),
      o('SC-005', 'Marble', 'Carrara', 760, 520, 240, 20),
      o('SC-006', 'Dekton', 'Kelya', 1300, 700, 260, 12),
      o('SC-007', 'Granite', 'Kashmir White', 600, 450, 150, 30),
      o('SC-008', 'Quartz', 'Pure White', 2100, 650, 210, 20, 'Full-depth worktop offcut'),
    ],
    enquiries: [],
  };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(DEMO_KEY)); if (s && s.offcuts) return s; } catch {}
  const s = seed(); save(s); return s;
}
function save(s) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); } catch (e) { console.warn('Demo save failed', e); } }
export function resetDemo() { localStorage.removeItem(DEMO_KEY); }

// ---------------- Offcuts ----------------
export async function listOffcuts({ includeSold = false } = {}) {
  const c = await client();
  if (!c) {
    const all = load().offcuts;
    return includeSold ? all : all.filter((o) => o.status !== 'sold');
  }
  let q = c.from('offcuts').select('*').order('created_at', { ascending: false });
  if (!includeSold) q = q.neq('status', 'sold');
  return must(await q);
}

export async function saveOffcut(o) {
  const row = {
    ref: o.ref || null, material: o.material, name: o.name,
    thickness_mm: +o.thickness_mm, length_mm: +o.length_mm, width_mm: +o.width_mm,
    price_per_m2: +o.price_per_m2, photo_url: o.photo_url || null,
    notes: o.notes || null, status: o.status || 'available',
  };
  const c = await client();
  if (!c) {
    const s = load();
    if (o.id) s.offcuts = s.offcuts.map((x) => (x.id === o.id ? { ...x, ...row } : x));
    else s.offcuts.unshift({ ...row, id: uid(), created_at: new Date().toISOString() });
    save(s); return;
  }
  if (o.id) must(await c.from('offcuts').update(row).eq('id', o.id));
  else must(await c.from('offcuts').insert(row));
}

export async function deleteOffcut(id) {
  const c = await client();
  if (!c) { const s = load(); s.offcuts = s.offcuts.filter((x) => x.id !== id); save(s); return; }
  must(await c.from('offcuts').delete().eq('id', id));
}

export async function nextRef() {
  const all = await listOffcuts({ includeSold: true });
  const n = all.map((o) => parseInt(String(o.ref || '').replace(/\D/g, ''), 10)).filter(Number.isFinite);
  return 'SC-' + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
}

/** Shrink a photo in the browser before upload (phones take 4–12MB shots). */
export async function compressImage(file, maxSide = 1600, quality = 0.82) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  let img = bmp;
  if (!img) {
    img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return new Promise((res) => cv.toBlob(res, 'image/jpeg', quality));
}

export async function uploadPhoto(file) {
  const c = await client();
  if (!c) {
    const blob = await compressImage(file, 900, 0.7); // keep demo storage small
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  }
  const blob = await compressImage(file);
  const path = `${new Date().getFullYear()}/${uid()}.jpg`;
  must(await c.storage.from('offcut-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
  return c.storage.from('offcut-photos').getPublicUrl(path).data.publicUrl;
}

// ---------------- Edge finishes ----------------
export async function listFinishes({ includeInactive = false } = {}) {
  const c = await client();
  let rows;
  if (!c) rows = load().finishes;
  else rows = must(await c.from('edge_finishes').select('*').order('sort').order('name'));
  rows = [...rows].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  return includeInactive ? rows : rows.filter((f) => f.active);
}

export async function saveFinish(f) {
  const row = { name: f.name, description: f.description || null, price_per_m: +f.price_per_m, sort: +f.sort || 0, active: !!f.active };
  if (f.profile) row.profile = f.profile;
  const c = await client();
  if (!c) {
    const s = load();
    if (f.id) s.finishes = s.finishes.map((x) => (x.id === f.id ? { ...x, ...row } : x));
    else s.finishes.push({ ...row, id: uid() });
    save(s); return;
  }
  if (f.id) must(await c.from('edge_finishes').update(row).eq('id', f.id));
  else must(await c.from('edge_finishes').insert(row));
}

export async function deleteFinish(id) {
  const c = await client();
  if (!c) { const s = load(); s.finishes = s.finishes.filter((x) => x.id !== id); save(s); return; }
  must(await c.from('edge_finishes').delete().eq('id', id));
}

// ---------------- Enquiries ----------------
export async function submitEnquiry(e) {
  const c = await client();
  const row = { ...e, created_at: new Date().toISOString(), handled: false };
  if (!c) { const s = load(); s.enquiries.unshift({ ...row, id: uid() }); save(s); return; }
  delete row.created_at; delete row.handled;
  must(await c.from('enquiries').insert(row));
  // Email alert to the business. Never blocks or fails the customer's request;
  // the daily keep-alive job retries anything that didn't send.
  try { await c.functions.invoke('enquiry-alert', { body: {} }); } catch (e) { console.warn('Alert not sent yet', e); }
}

export async function listEnquiries() {
  const c = await client();
  if (!c) return load().enquiries;
  return must(await c.from('enquiries').select('*').order('created_at', { ascending: false }).limit(200));
}

export async function setEnquiryHandled(id, handled) {
  const c = await client();
  if (!c) { const s = load(); s.enquiries = s.enquiries.map((x) => (x.id === id ? { ...x, handled } : x)); save(s); return; }
  must(await c.from('enquiries').update({ handled }).eq('id', id));
}

// ---------------- Auth (admin) ----------------
export async function currentAdmin() {
  const c = await client();
  if (!c) return { email: 'demo@local', demo: true };
  const { data: { session } } = await c.auth.getSession();
  if (!session) return null;
  const { data } = await c.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
  return data ? { email: session.user.email, id: session.user.id } : { email: session.user.email, notAdmin: true };
}
/** Create a staff account. Returns { needsConfirm } when Supabase emails a confirmation link first. */
export async function signUp(email, password) {
  const c = await client();
  const redirect = location.origin + location.pathname; // back to admin.html after confirming
  const data = must(await c.auth.signUp({ email, password, options: { emailRedirectTo: redirect } }));
  return { needsConfirm: !data.session };
}

// ---------------- Admin approvals ----------------
export async function listAccessRequests() {
  const c = await client();
  if (!c) return [];
  return must(await c.from('access_requests').select('*').order('created_at', { ascending: false }));
}
export async function listAdmins() {
  const c = await client();
  if (!c) return [{ user_id: 'demo', email: 'demo@local', created_at: new Date().toISOString() }];
  return must(await c.rpc('list_admins'));
}
export async function approveAdmin(userId) {
  const c = await client(); if (!c) return;
  must(await c.rpc('approve_admin', { target: userId }));
}
export async function removeAdmin(userId) {
  const c = await client(); if (!c) return;
  must(await c.rpc('remove_admin', { target: userId }));
}
export async function declineRequest(userId) {
  const c = await client(); if (!c) return;
  must(await c.from('access_requests').delete().eq('user_id', userId));
}
export async function signIn(email, password) {
  const c = await client();
  must(await c.auth.signInWithPassword({ email, password }));
}
export async function signOut() {
  const c = await client();
  if (c) await c.auth.signOut();
}
