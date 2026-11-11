// Editable site content: wording and images staff can change in admin → Site content.
// The page's own text is the original; anything saved in the site_content table replaces it.
import { SETTINGS } from './config.js';
import { $, $$, esc, mountChrome } from './ui.js';

/**
 * Every editable item, grouped by section in page order.
 * type: text (one line) · textarea · lines (one item per line) · image
 * Items with `dom` take their original wording from the element marked data-content="<key>" in index.html.
 * The rest carry their original in `default`.
 */
export const SECTIONS = [
  {
    id: 'hero', title: 'Top banner', where: 'The big banner at the top of the home page.',
    fields: [
      { key: 'hero.image', label: 'Background image', type: 'image', help: 'A wide landscape photo works best (at least 1600px wide). Text sits on top, so a darker or busy photo is fine: the site darkens it automatically.' },
      { key: 'hero.eyebrow', label: 'Small line above the heading', type: 'text', dom: true },
      { key: 'hero.heading', label: 'Heading', type: 'text', dom: true },
      { key: 'hero.text', label: 'Introduction', type: 'textarea', dom: true },
      { key: 'hero.button1', label: 'First button', type: 'text', dom: true },
      { key: 'hero.button2', label: 'Second button', type: 'text', dom: true },
    ],
  },
  {
    id: 'finder', title: 'Find your cut', where: 'The price calculator section.',
    fields: [
      { key: 'finder.eyebrow', label: 'Small line above the heading', type: 'text', dom: true },
      { key: 'finder.heading', label: 'Heading', type: 'text', dom: true },
      { key: 'finder.text', label: 'Introduction', type: 'textarea', dom: true },
      { key: 'pricing.note', label: 'Note under every price', type: 'text', default: SETTINGS.priceNote, help: 'Shown under the results and in each offcut\'s price breakdown.' },
    ],
  },
  {
    id: 'stock', title: 'In the yard now', where: 'The section listing every offcut in stock.',
    fields: [
      { key: 'stock.eyebrow', label: 'Small line above the heading', type: 'text', dom: true },
      { key: 'stock.heading', label: 'Heading', type: 'text', dom: true },
      { key: 'stock.text', label: 'Introduction', type: 'textarea', dom: true },
    ],
  },
  {
    id: 'pricing', title: 'How pricing works', where: 'The pricing explanation, next to the edge finishes table.',
    fields: [
      { key: 'pricing.eyebrow', label: 'Small line above the heading', type: 'text', dom: true },
      { key: 'pricing.heading', label: 'Heading', type: 'text', dom: true },
      { key: 'pricing.text', label: 'Introduction', type: 'textarea', dom: true },
      { key: 'step1.title', label: 'Step 1 title', type: 'text', dom: true },
      { key: 'step1.text', label: 'Step 1 text', type: 'textarea', dom: true },
      { key: 'step2.title', label: 'Step 2 title', type: 'text', dom: true },
      { key: 'step2.text', label: 'Step 2 text', type: 'textarea', dom: true },
      { key: 'step3.title', label: 'Step 3 title', type: 'text', dom: true },
      { key: 'step3.text', label: 'Step 3 text', type: 'textarea', dom: true },
      { key: 'pricing.uses', label: 'Things people make (tiles)', type: 'lines', dom: true, help: 'One per line. Each becomes a tile under the edge finishes table.' },
    ],
  },
  {
    id: 'footer', title: 'Footer and contact details', where: 'The dark footer at the bottom of every page.',
    fields: [
      { key: 'brand.logo', label: 'Logo', type: 'image', help: 'Replaces the drawn logo in the header. A PNG with a transparent background works best.' },
      { key: 'footer.blurb', label: 'Short description', type: 'textarea', default: 'Premium stone offcuts from the Granite Systems workshop, cut and finished to your size.' },
      { key: 'contact.phone', label: 'Phone', type: 'text', default: SETTINGS.contact.phone },
      { key: 'contact.email', label: 'Email', type: 'text', default: SETTINGS.contact.email },
      { key: 'contact.address', label: 'Address', type: 'lines', default: SETTINGS.contact.address.join('\n'), help: 'One line per row.' },
    ],
  },
  {
    id: 'seo', title: 'Google and sharing', where: 'What shows in Google results and when the link is shared.',
    fields: [
      { key: 'seo.title', label: 'Page title', type: 'text', default: 'Second Cut Stone | Premium Stone Offcuts, Cut to Size | Kirkcaldy, Fife', help: 'Keep it under about 60 characters so Google shows it in full.' },
      { key: 'seo.description', label: 'Description', type: 'textarea', default: 'Granite, quartz, marble and Dekton offcuts from the Granite Systems workshop in Kirkcaldy. Enter your sizes, choose your edges and see the price instantly.', help: 'Keep it under about 155 characters.' },
    ],
  },
];
export const FIELDS = SECTIONS.flatMap((s) => s.fields.map((f) => ({ ...f, section: s.id })));

const CACHE_KEY = 'scs-content-v1';
let CONTENT = {};

/** Only images we uploaded (https) or demo-mode data URLs are ever used as image sources. */
export const safeImage = (v) => (typeof v === 'string' && /^(https:\/\/|data:image\/(png|jpe?g|webp|gif);)/i.test(v) ? v : '');

export function priceNote() { return CONTENT['pricing.note'] || SETTINGS.priceNote; }

/** Read the original wording of a page item from a document (index.html). */
export function originalFrom(doc, f) {
  if (!f.dom) return f.default ?? '';
  const el = doc.querySelector(`[data-content="${f.key}"]`);
  if (!el) return '';
  if (f.type === 'lines') return [...el.children].map((c) => c.textContent.trim()).join('\n');
  return el.textContent.trim().replace(/\s+/g, ' ');
}

/** Apply saved content to the current page. Safe to call more than once. */
let CHROME = {};
export function applyContent(map = CONTENT, { rechrome = false } = {}) {
  CONTENT = map || {};
  const c = CONTENT;
  // contact details and footer feed the shared header/footer
  if (c['contact.phone']) SETTINGS.contact.phone = c['contact.phone'];
  if (c['contact.email']) SETTINGS.contact.email = c['contact.email'];
  if (c['contact.address']) SETTINGS.contact.address = c['contact.address'].split('\n').map((s) => s.trim()).filter(Boolean);
  if (rechrome) mountChrome(CHROME);

  $$('[data-content]').forEach((el) => {
    const v = c[el.dataset.content];
    if (!v) return;
    if (el.hasAttribute('data-content-lines')) {
      const tag = el.dataset.contentLines || 'div', cls = el.dataset.contentClass || '';
      el.innerHTML = v.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => `<${tag} class="${esc(cls)}">${esc(s)}</${tag}>`).join('');
    } else el.textContent = v;
  });
  const foot = $('#site-footer [data-footer-blurb]');
  if (foot && c['footer.blurb']) foot.textContent = c['footer.blurb'];

  const hero = safeImage(c['hero.image']), heroEl = $('#hero-stone');
  if (hero && heroEl) heroEl.innerHTML = `<img src="${esc(hero)}" alt="" style="width:100%;height:100%;object-fit:cover">`;
  const logo = safeImage(c['brand.logo']), brand = $('#site-header .brand');
  if (logo && brand) brand.innerHTML = `<img src="${esc(logo)}" alt="Second Cut Stone" class="logo-img">`;

  if (c['seo.title'] && $('[data-content-page="home"]')) document.title = c['seo.title'];
  if (c['seo.description']) $('meta[name="description"]')?.setAttribute('content', c['seo.description']);
}

/** Apply the last-seen content straight away (no flash of old wording), then the latest from the database. */
export async function loadContent(fetcher, chromeOptions = {}) {
  CHROME = chromeOptions;
  try { applyContent(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'), { rechrome: true }); } catch {}
  try {
    const fresh = await fetcher();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch {}
    applyContent(fresh, { rechrome: true });
  } catch (e) { console.warn('Site content not loaded', e); }
  return CONTENT;
}
