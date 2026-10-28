// "View in your room" pilot: builds a true-size 3D slab from the chosen piece and offcut,
// shows it in a 3D viewer, and hands it to the phone's AR (Quick Look on iPhone, WebXR on Android).
// Libraries load only when someone opens it, so the rest of the site stays fast.
import { swatchSVG, esc, mm } from './ui.js';

const MODEL_VIEWER = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer-module.min.js';
const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';

let libsPromise = null;
function loadLibs() {
  libsPromise ||= Promise.all([
    import('three'),
    import('three/addons/exporters/GLTFExporter.js'),
    import('three/addons/exporters/USDZExporter.js'),
    import(MODEL_VIEWER),
  ]).then(([THREE, { GLTFExporter }, { USDZExporter }]) => ({ THREE, GLTFExporter, USDZExporter }));
  return libsPromise;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = Object.assign(document.createElement('script'), { src, onload: res, onerror: rej });
    document.head.appendChild(s);
  });
}

function loadImage(src, crossOrigin = true) {
  return new Promise((res, rej) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** The stone surface: the offcut photo, or its generated swatch, cropped to the piece's proportions. */
async function stoneCanvas(offcut, L, W) {
  let img = null;
  if (offcut.photo_url) img = await loadImage(offcut.photo_url).catch(() => null);
  if (!img) {
    const svg = swatchSVG(offcut, { w: 1200, h: 900 }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" ');
    img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), false);
  }
  const max = 2048, aspect = L / W;
  const cw = aspect >= 1 ? max : Math.round(max * aspect), ch = aspect >= 1 ? Math.round(max / aspect) : max;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  // cover-crop the image to the piece's aspect ratio
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.max(cw / iw, ch / ih), dw = iw * s, dh = ih * s;
  g.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  // average colour, used for the slab's sides
  const t = document.createElement('canvas'); t.width = t.height = 1;
  t.getContext('2d').drawImage(c, 0, 0, 1, 1);
  const [r, gg, b] = t.getContext('2d').getImageData(0, 0, 1, 1).data;
  return { canvas: c, avg: `rgb(${r},${gg},${b})` };
}

/** Build the slab and export it as GLB (viewer + Android) and USDZ (iPhone Quick Look). */
async function buildModel(offcut, piece) {
  const { THREE, GLTFExporter, USDZExporter } = await loadLibs();
  const L = piece.bboxL / 1000, W = piece.bboxW / 1000, T = (offcut.thickness_mm || 20) / 1000;
  const { canvas, avg } = await stoneCanvas(offcut, piece.bboxL, piece.bboxW);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const scene = new THREE.Scene();
  const slab = new THREE.Group(); slab.name = 'slab';
  // body: the sides of the slab, in the stone's average colour
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(L, T * 0.995, W),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(avg), roughness: 0.4, metalness: 0 }),
  );
  body.position.y = (T * 0.995) / 2; body.name = 'edges';
  // top: the polished face with the stone photo; back edge of the photo = back of the piece
  const topGeo = new THREE.PlaneGeometry(L, W); topGeo.rotateX(-Math.PI / 2);
  const top = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0 }));
  top.position.y = T; top.name = 'surface';
  slab.add(body, top);
  scene.add(slab);

  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  const usdz = await new USDZExporter().parseAsync(scene, { quickLookCompatible: true, maxTextureSize: 2048, ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: 'horizontal' } } });
  tex.dispose();
  return {
    glbUrl: URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' })),
    usdzUrl: URL.createObjectURL(new Blob([usdz], { type: 'model/vnd.usdz+zip' })),
  };
}

let lastUrls = [];

/**
 * Open the "View in your room" panel.
 * @param host    element to render into (inside a modal)
 * @param offcut  the chosen offcut
 * @param piece   geometry from shapes.js (rectangle or square)
 * @param shareUrl link that reopens this view, for the desktop QR code
 */
export async function showInRoom(host, offcut, piece, shareUrl) {
  const size = `${mm(Math.round(piece.bboxL))} × ${mm(Math.round(piece.bboxW))} × ${offcut.thickness_mm}mm`;
  host.innerHTML = `
    <div class="ar-head">
      <div class="eyebrow" style="margin:0">Pilot · View in your room</div>
      <h2 style="margin:4px 0 2px">${esc(offcut.name)}</h2>
      <p class="muted" style="margin:0">${esc(offcut.material)} · shown at true size ${size}</p>
    </div>
    <div class="ar-stage"><div class="ar-loading">Building your piece in 3D…</div></div>
    <div class="ar-foot"></div>`;
  const stage = host.querySelector('.ar-stage'), foot = host.querySelector('.ar-foot');

  let urls;
  try { urls = await buildModel(offcut, piece); }
  catch (e) {
    console.error(e);
    stage.innerHTML = `<div class="ar-loading">Sorry, the 3D view couldn't load on this device.</div>`;
    return;
  }
  lastUrls.forEach(URL.revokeObjectURL); lastUrls = [urls.glbUrl, urls.usdzUrl];

  stage.innerHTML = `
    <model-viewer src="${urls.glbUrl}" ios-src="${urls.usdzUrl}" alt="${esc(offcut.name)} piece, ${size}"
      ar ar-modes="webxr quick-look" ar-placement="floor" ar-scale="fixed"
      camera-controls touch-action="pan-y" shadow-intensity="1" shadow-softness="0.8"
      exposure="0.95" environment-image="neutral" camera-orbit="25deg 60deg auto" interaction-prompt="none">
      <button slot="ar-button" class="btn ar-btn">Place it in my room</button>
    </model-viewer>`;
  const mv = stage.querySelector('model-viewer');

  const phoneHelp = `
    <ol class="ar-steps">
      <li>Tap <strong>Place it in my room</strong> and allow the camera.</li>
      <li>Point your phone at the floor or a worktop and move it slowly until the slab appears.</li>
      <li>Drag to move it, twist with two fingers to rotate. Walk around it to check the fit.</li>
    </ol>
    <p class="note">True size, accurate to about 1–2cm. It's a guide: we always measure before cutting.</p>`;

  const desktopHelp = async () => {
    foot.innerHTML = `
      <div class="ar-qr">
        <div class="qr" aria-label="QR code to open this on your phone"></div>
        <div>
          <strong>See it in your room on your phone</strong>
          <p class="muted" style="margin:4px 0 0">Scan this with your phone camera to open this piece, then tap <em>Place it in my room</em>. Works on recent iPhones (iOS 12+) and most Android phones.</p>
          <p class="muted" style="margin:8px 0 0">Here you can drag to spin the slab and scroll to zoom.</p>
        </div>
      </div>`;
    try {
      await loadScript(QR_LIB);
      const q = window.qrcode(0, 'M'); q.addData(shareUrl); q.make();
      foot.querySelector('.qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch { foot.querySelector('.qr').remove(); }
  };

  const decide = () => (mv.canActivateAR ? (foot.innerHTML = phoneHelp) : desktopHelp());
  mv.addEventListener('load', decide, { once: true });
  mv.addEventListener('ar-status', (e) => {
    if (e.detail.status === 'failed') foot.insertAdjacentHTML('afterbegin', `<p class="error">Your phone couldn't start AR here. Try Safari on iPhone or Chrome on Android.</p>`);
  });
}
