// 十七時の残響：ホーム画面に追加したアプリで、すぐ開けて、電波が弱くても遊べるようにする仕組み（Service Worker）
// ・ひだまり島ぐらしと同じ形。ゲーム本体（./）は新しい版を取りに行き、3秒で返事がなければ保存してある版で開く
// ・絵・音楽・文字のフォントなどは、一度読んだら保存して、次からはそれを使う
// ・ゲームの版を上げたら、下の CACHE の版の番号も上げる（古い版の保存分は消える。フォントは残す）
const CACHE = 'zankyo-2.55a';
const FONTS = 'zankyo-fonts';
const V = '?v=2.55a';
const PAGE = './';
const CORE = [PAGE, './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './css/style.css' + V,
  ...['data', 'script', 'script_plus', 'script_plus2', 'script_plus3', 'script_plus4', 'script_plus5', 'script_plus6', 'waltz', 'audio', 'engine'].map(n => './js/' + n + '.js' + V)];
const WAIT_MS = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('zankyo-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function page(e) {
  const net = fetch(e.request).then(r => {
    if (r && r.ok) { const cp = r.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(PAGE, cp))); }
    return r;
  });
  e.waitUntil(net.catch(() => {}));
  const saved = caches.open(CACHE).then(c => c.match(PAGE));
  const good = net.then(r => r.ok ? r : saved.then(s => s || r));
  const late = new Promise(res => setTimeout(res, WAIT_MS)).then(() => saved).then(s => s || good);
  return Promise.race([good, late]).catch(() => saved.then(s => s || Response.error()));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    if (/\/play\/(index\.html)?$/.test(url.pathname)) e.respondWith(page(e));
    return;
  }
  const store = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) ? FONTS : CACHE;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); e.waitUntil(caches.open(store).then(c => c.put(req, cp))); }
    return r;
  })));
});
