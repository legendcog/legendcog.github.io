/* 『十七時の残響』 本体 */
"use strict";

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
let turbo = false;       // 確認用：待ち時間を飛ばす（?debug のときだけ切り替えられる）
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const sleep = (ms) => (turbo ? tick() : new Promise((r) => setTimeout(r, ms)));
const SAVE_KEY = "zankyo_save_v2";   // 筋を書き直した Ver 1.20 から v2（前の版の保存とは混ぜない）
const SUSPECTS = ["rena", "uta", "marika", "taiga", "ren", "koga"];
/* 顔の位置（立ち絵に対する割合）: 中心x, 中心y, 幅 */
const FACE = {
  hiyori: [0.52, 0.29, 0.42], rena: [0.49, 0.299, 0.32], uta: [0.5, 0.31, 0.44], marika: [0.5, 0.2, 0.4],
  taiga: [0.52, 0.22, 0.36], ren: [0.46, 0.17, 0.32], makabe: [0.49, 0.21, 0.34], koga: [0.5, 0.17, 0.3], kotone: [0.517, 0.186, 0.303],
};
/* 立ち絵をそろえる。大きさは目分量でなく、測った値から計算で決める。
   人の頭の大きさは、身長が違ってもほとんど変わらない（あごから頭のてっぺんまで、およそ22〜24cm）。
   そこで「頭の大きさ」を全員ほぼ同じにそろえ、身長の高い人ほど、ほんの少しだけ大きくする（身長の0.25乗。152cmと182cmで約5%の差）。
   SPR：[頭の高さ, 目の高さ, 顔の中心x, あご, 頭のてっぺん]。
        頭の高さは、元の絵（高さ1368）の画素数。「あごから頭のてっぺんまで」と「顔（目からあごまで×顔の幅）」の2つを測り、
        その両方から出した拡大率の平均になるように決めた値（髪の量や絵柄で片方だけがずれるのを防ぐため）。あとの4つは絵の高さ・幅に対する割合。
   拡大率 = HEAD_PX ×（身長÷170）^HEAD_POW ÷ 測った頭の高さ。そのうえで、身長の差だけ目の高さを上下させる。
   確認図は tools/lineup.py で作る。 */
const SPR = { hiyori: [411, 0.285, 0.52, 0.386, 0.051],
  rena: [419, 0.274, 0.49, 0.386, 0.076],
  uta: [334, 0.318, 0.5, 0.404, 0.152],
  marika: [405, 0.197, 0.51, 0.307, 0.020],
  taiga: [366, 0.216, 0.52, 0.326, 0.069],
  ren: [307, 0.164, 0.46, 0.242, 0.016],
  makabe: [439, 0.173, 0.49, 0.315, 0.002],
  koga: [333, 0.153, 0.5, 0.260, 0.042],
  kotone: [320, 0.174, 0.517, 0.263, 0.030] };
const HEAD_PX = 380, HEAD_POW = 0.25;        // 身長170cmの人の頭を、元の絵の何画素ぶんに描くか／身長による変化の強さ
const HEIGHT_REF = 176, HEIGHT_K = 0.0066;   // 高さの基準にする身長と、身長 1cm ぶんの上下（基準の高さに対する割合）
function sprScale(id) { const c = CHARS[id] || {}; return HEAD_PX * Math.pow((c.height || 170) / 170, HEAD_POW) / (SPR[id] || [380])[0]; }
function placeSprite(img, id, baseH, eyeY) {
  const [, eye, fx] = SPR[id] || [380, 0.2, 0.5], h = baseH * sprScale(id), w = h * 936 / 1368;
  const y = eyeY - ((CHARS[id] && CHARS[id].height || HEIGHT_REF) - HEIGHT_REF) * baseH * HEIGHT_K;
  img.style.height = h + "px"; img.style.width = w + "px"; img.style.top = (y - eye * h) + "px"; img.style.marginLeft = (-fx * w) + "px";
}

let S = null;          // 進行状況（保存する）
let mode = "title";    // title / scene / idle / menu
let skipMode = false, typing = false, skipType = false, advResolve = null;
let textSpeed = 26, lifeN = 5, lifeOn = false;
let curSprite = "", log = [];

/* ================================================================ 状態 */
function newState() {
  return { flags: {}, ev: [], evStage: {}, tes: [], ded: [], loc: "hallway", seenHs: {}, readT: {}, auto: {}, fresh: {}, mistakes: 0, hints: 0, chat: 0, cp: null, t: 0, started: false, clock: 0, warn: 0, accused: null, pname: null };
}
const has = (id) => !!S.flags[id];
function cond(c) {
  if (!c) return true;
  return c.split("|").some((t) => t.split("&").every((x) => { x = x.trim(); return x[0] === "!" ? !has(x.slice(1)) : has(x); }));
}
function okItem(spec) {            // "trophy@1" → 段階1以上で持っているか
  const [id, st] = spec.split("@");
  return has(id) && (!st || (S.evStage[id] || 0) >= +st);
}
function save(quiet) {
  let ok = true;
  try { S.t = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { ok = false; /* 保存できなくても遊べる */ }
  if (!quiet || !ok) savedMark(ok);
  return ok;
}
/* 保存したことを、画面の右上に小さく出す（できなかったときも、そう出す） */
function savedMark(ok) {
  const m = $("#saved"); if (!m) return;
  m.textContent = ok ? "記録しました" : "記録できませんでした";
  m.classList.toggle("ng", !ok); m.classList.add("on");
  clearTimeout(savedMark.t); savedMark.t = setTimeout(() => m.classList.remove("on"), ok ? 1700 : 3200);
}
function loadSave() { try { const j = localStorage.getItem(SAVE_KEY); return j ? JSON.parse(j) : null; } catch (e) { return null; } }

/* ================================================================ 文字の整形 */
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
/* 主人公の名前。台本と定義には、もとの名前（霧島 湊、ひよりの呼び方はミナト）のまま書いてあり、出すときに置きかえる */
const PNAME = { sei: "霧島", mei: "湊", yobi: "ミナト" };
function pname() { return (S && S.pname) || PNAME; }
function nameFill(t) {
  const p = pname();
  if (p.sei === PNAME.sei && p.mei === PNAME.mei && p.yobi === PNAME.yobi) return t;
  return String(t).replace(/霧島|ミナト|湊/g, (m) => (m === "霧島" ? p.sei : m === "湊" ? p.mei : p.yobi));
}
function applyName() { const p = pname(); CHARS.me.name = p.sei + " " + p.mei; CHARS.me.short = p.mei; }
const kwHtml = (s) => esc(nameFill(s)).replace(/《(.+?)》/g, '<span class="kw">$1</span>');
function parseLine(line) {
  const m = /^([a-z_]*)(?:\/([a-z_]+))?:\s?([\s\S]*)$/.exec(line);
  return m ? { who: m[1] || "n", expr: m[2] || "normal", text: m[3] } : { who: "n", expr: "normal", text: line };
}
/* 1文字ずつ出せるよう span に分ける。《強調》と {a|選べる言葉} を解釈する */
function buildText(text) {
  const frag = document.createDocumentFragment(); const spans = [];
  const re = /《(.+?)》|\{([a-z])\|(.+?)\}/g; let last = 0, m;
  const put = (str, parent, cls) => { for (const ch of str) { if (ch === "／") { parent.appendChild(document.createElement("br")); continue; }   // 全角の「／」は、その場所で改行
    const s = el("span", "c" + (cls ? " " + cls : "")); s.textContent = ch; parent.appendChild(s); spans.push(s); } };
  while ((m = re.exec(text))) {
    put(text.slice(last, m.index), frag);
    if (m[1]) put(m[1], frag, "kw");
    else { const p = el("span", "pick"); p.dataset.k = m[2]; put(m[3], p); frag.appendChild(p); }
    last = re.lastIndex;
  }
  put(text.slice(last), frag);
  return { frag, spans };
}
const plain = (t) => t.replace(/《(.+?)》/g, "$1").replace(/\{[a-z]\|(.+?)\}/g, "$1").replace(/／/g, " ");

/* ================================================================ 画面の部品 */
/* スマホを縦に持っているときは、舞台を90度回して横長のまま画面いっぱいに出す */
const isTouch = matchMedia("(pointer: coarse)").matches;
let fitS = 1, fitRot = false;
function fit() {
  if (document.activeElement && document.activeElement.tagName === "INPUT") return;
  fitRot = isTouch && innerHeight > innerWidth;
  const w = fitRot ? innerHeight : innerWidth, h = fitRot ? innerWidth : innerHeight;
  const s = fitS = Math.min(w / 1280, h / 720);
  const a = $("#app"); a.style.transform = `${fitRot ? "rotate(90deg) " : ""}translate(${-640 * s}px, ${-360 * s}px) scale(${s})`;
}
addEventListener("resize", fit);
if (screen.orientation) screen.orientation.addEventListener("change", () => setTimeout(fit, 60));
/* 画面上の位置 → 舞台の中の位置（1280x720） */
function stagePos(cx, cy) {
  const dx = cx - innerWidth / 2, dy = cy - innerHeight / 2;
  const lx = fitRot ? dy : dx, ly = fitRot ? -dx : dy;
  return [lx / fitS + 640, ly / fitS + 360];
}
/* スマホでは、始めるときに全画面にして横向きに固定する（できない機種では何もしない） */
function goFull() {
  if (!isTouch || document.fullscreenElement) return;
  try {
    const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape")).catch(() => {});
  } catch (e) { /* 全画面にできなくても遊べる */ }
}

let bgFlip = false, bgNow = "";
function setBg(id) {
  if (id === bgNow) return;
  bgNow = id;
  const a = bgFlip ? $("#bgA") : $("#bgB"), b = bgFlip ? $("#bgB") : $("#bgA");
  a.style.backgroundImage = `url(img/bg/${id}.jpg${IMG_V})`; a.classList.add("on"); b.classList.remove("on"); bgFlip = !bgFlip;
  const outside = id === "walkway" || id === "gymback";
  $("#rain").classList.toggle("on", outside && !rainStopped);
  Snd.rainAt(outside);
}
let rainStopped = false;   // 真相の結末で雨が上がったあとは、外でも雨を描かない
function spriteSrc(id, expr) { return `img/ch/${id}${expr && expr !== "normal" ? "_" + expr : ""}.webp${IMG_V}`; }
/* ---------- 複数人の立ち絵：話し合いの場面で、3人までを少し小さくして 左・中央・右 に並べる。
   台本の { cast: ["rena", "marika", "uta"] } で並べ、{ cast: [] } か { hide: 1 } で解く。
   並んでいない人が話したら、空きがあれば加わり、3人いれば、いちばん前に話した人と入れかわる。
   話している人は明るく少し前へ、ほかの人は暗くする */
let cast = [], castTick = 0;
const CAST_X = { 1: [50], 2: [35, 65], 3: [21, 50, 79] };
function setCast(ids) {
  $("#sprite").classList.remove("on"); curSprite = "";
  cast = (ids || []).slice(0, 3).map((id) => ({ id, expr: "normal", t: 0 }));
  drawCast(null, true);
}
function clearCast() { if (!cast.length) return; cast = []; drawCast(null); }
function castSpeak(id, expr) {
  let m = cast.find((c) => c.id === id), isNew = false;
  if (!m) {
    isNew = true;
    if (cast.length < 3) { m = { id }; cast.push(m); } else { m = cast.reduce((a, b) => (a.t <= b.t ? a : b)); m.id = id; }
  }
  m.expr = expr || "normal"; m.t = ++castTick;
  drawCast(id, false, isNew ? id : null);
}
function drawCast(active, all, fresh) {
  const box = $("#cast"), xs = CAST_X[cast.length] || [];
  while (box.children.length > cast.length) box.lastChild.remove();
  cast.forEach((c, i) => {
    let img = box.children[i];
    if (!img) { img = el("img"); img.alt = ""; box.appendChild(img); }
    const key = c.id + "/" + c.expr;
    if (img.dataset.key !== key) {
      const same = (img.dataset.key || "").split("/")[0] === c.id;
      img.onerror = () => { img.onerror = null; img.src = spriteSrc(c.id); };
      img.src = spriteSrc(c.id, c.expr); img.dataset.key = key;
      placeSprite(img, c.id, 660, 262);
      img.classList.remove("in", "pop"); void img.offsetWidth; img.classList.add(same ? "pop" : "in");
    }
    img.style.left = xs[i] + "%";
    img.classList.toggle("spk", c.id === active);
    img.style.zIndex = c.id === active ? 3 : 1;
  });
  box.classList.toggle("on", cast.length > 0);
}
function setSprite(id, expr) {
  const box = $("#sprite"), img = $("#spriteImg");
  if (!id) { box.classList.remove("on"); curSprite = ""; clearCast(); return; }
  const key = id + "/" + expr;
  if (key === curSprite) { box.classList.remove("dim"); return; }
  const changed = !curSprite || curSprite.split("/")[0] !== id;
  img.onerror = () => { img.onerror = null; img.src = spriteSrc(id); };
  img.src = spriteSrc(id, expr);
  placeSprite(img, id, 818, 232);
  box.classList.remove("pop", "enter", "dim"); void box.offsetWidth;
  box.classList.add("on", changed ? "enter" : "pop");
  curSprite = key;
}
function faceEl(id, D) {
  const f = el("span", "face"); const c = CHARS[id];
  f.style.width = f.style.height = D + "px"; f.style.setProperty("--c", c.color);
  const fc = FACE[id];
  if (fc) {
    const W = D / fc[2], H = W * 1368 / 936;
    f.style.backgroundImage = `url(${spriteSrc(id)})`;
    f.style.backgroundSize = `${W}px ${H}px`;
    f.style.backgroundPosition = `${-(fc[0] * W - D / 2)}px ${-(fc[1] * H - D / 2)}px`;
  }
  return f;
}
function toast(msg, ms = 1800) { const t = $("#toast"); t.innerHTML = kwHtml(msg); t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), ms); }
function flash(kind) {
  const f = $("#flash"); f.className = ""; void f.offsetWidth;
  if (kind === "white") f.classList.add("go");
}
async function fade() {
  const f = $("#flash"); f.className = "black"; void f.offsetWidth; f.classList.add("fadeout"); await sleep(skipMode ? 80 : 480);
  setSprite(null);
  setTimeout(() => { f.classList.remove("fadeout"); f.classList.add("fadein"); setTimeout(() => { f.className = ""; }, 650); }, 60);
}
function shake() { const a = $("#app"); a.classList.remove("shake"); void a.offsetWidth; a.classList.add("shake"); setTimeout(() => a.classList.remove("shake"), 500); }

/* ================================================================ 進める操作 */
function waitAdv() { return new Promise((r) => { advResolve = r; }); }
function doAdv() { if (typing) { skipType = true; return; } if (advResolve) { const r = advResolve; advResolve = null; r(); } }
$("#dlg").addEventListener("click", (e) => { if (e.target.closest("button") || e.target.closest(".pick.live")) return; doAdv(); });
$("#stage").addEventListener("click", () => { if (mode === "scene") doAdv(); });
$("#fx").addEventListener("click", doAdv);
addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { if (mode === "scene" && !$("#logOv").classList.contains("on")) { e.preventDefault(); doAdv(); } }
  if (e.key === "Control") setSkip(true);
  if (e.key === "Escape") closeTopOverlay();
});
addEventListener("keyup", (e) => { if (e.key === "Control") setSkip(false); });
function setSkip(v) { skipMode = v; $("#btnSkip").classList.toggle("on", v); if (v) doAdv(); }
$("#btnSkip").addEventListener("click", (e) => { e.stopPropagation(); setSkip(!skipMode); });

/* ================================================================ 会話 */
/* 時間：18時40分から、移動1回ごとに1分15秒 */
const clockMin = () => 1120 + Math.floor((S.clock || 0) * 1.25);
const leftMin = () => Math.max(0, 1230 - clockMin());
function drawClock() {
  const m = clockMin();
  $("#clockNow").textContent = Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
  $("#clockLeft").textContent = "警察の到着まで " + leftMin() + "分";
  $("#clock").classList.toggle("hurry", leftMin() <= 30);
}
/* 台本の中の @now（今の時刻）・@left（残り時間）・@acc（名指しした相手）を置きかえる */
function fillText(t) {
  t = nameFill(t);
  if (t.indexOf("@") < 0) return t;
  const m = clockMin();
  return t.replace(/@now/g, Math.floor(m / 60) + "時" + (m % 60 ? String(m % 60).padStart(2, "0") + "分" : ""))
    .replace(/@left/g, "あと" + leftMin() + "分")
    .replace(/@acc/g, S.accused ? CHARS[S.accused].name.replace(" ", "") : "");
}
/* 最後の行に1〜3文字だけ残る折り返しを直す。
   文字の並ぶ幅を少しずつせばめて、行数を増やさずに、最後の行が4文字以上になる幅をさがす */
const LAST_MIN = 4;
function lineShape(tx, spans) {
  const lh = parseFloat(getComputedStyle(tx).lineHeight) || 45, top0 = spans[0].offsetTop;
  const rows = spans.map((s) => Math.round((s.offsetTop - top0) / lh)), last = rows[rows.length - 1];
  return { lines: last + 1, tail: rows.filter((r) => r === last).length };
}
function fitLines(tx, spans) {
  tx.style.paddingLeft = tx.style.paddingRight = "";
  if (spans.length < 2) return;
  const base = lineShape(tx, spans);
  if (base.lines < 2 || base.tail >= LAST_MIN) return;
  const both = tx.classList.contains("narr");   // 地の文はまん中ぞろえなので、左右を同じだけせばめる
  for (let pad = 8; pad <= 300; pad += 8) {
    tx.style.paddingRight = pad + "px"; if (both) tx.style.paddingLeft = pad + "px";
    const now = lineShape(tx, spans);
    if (now.lines > base.lines) break;
    if (now.tail >= LAST_MIN) return;
  }
  tx.style.paddingLeft = tx.style.paddingRight = "";
}
async function showLine(line, opt = {}) {
  const p = parseLine(fillText(line)), ch = CHARS[p.who] || CHARS.n;
  const dlg = $("#dlg"), tx = $("#dlgText"), np = $("#namePlate");
  $("#stage").classList.add("scene"); dlg.classList.add("on");
  $("#hud").classList.add("off"); $("#actions").classList.add("off"); $("#idleTip").classList.add("off");
  if (cast.length) { if (!ch.noSprite) castSpeak(p.who, p.expr); else drawCast(null); }
  else if (!ch.noSprite) setSprite(p.who, p.expr); else if (curSprite) $("#sprite").classList.toggle("dim", p.who === "me" || p.who === "n");
  dlg.style.setProperty("--c", ch.color || "#8d93b5");
  np.classList.toggle("none", p.who === "n"); $("#nameText").textContent = ch.name;
  tx.className = p.who === "n" ? "narr" : (p.who === "me" && p.text.startsWith("（") ? "mono" : "");
  const { frag, spans } = buildText(p.text);
  tx.innerHTML = ""; tx.appendChild(frag); fitLines(tx, spans);
  $("#dlgNext").classList.remove("on");
  if (!opt.instant) log.push({ who: p.who, text: plain(p.text) });
  if (log.length > 300) log.shift();
  if (opt.instant || skipMode) spans.forEach((s) => s.classList.add("on"));
  else {
    typing = true; skipType = false; let kwOn = false;
    for (let i = 0; i < spans.length; i++) {
      if (skipType) break;
      spans[i].classList.add("on");
      const isKw = spans[i].classList.contains("kw");
      if (isKw && !kwOn) Snd.sfx("kw"); kwOn = isKw;
      if (i % 3 === 0) Snd.sfx("blip");
      const c = spans[i].textContent;
      await sleep("。、！？…―".includes(c) ? textSpeed * 2.6 : textSpeed);
    }
    spans.forEach((s) => s.classList.add("on")); typing = false;
  }
  return tx;
}
async function say(line) {
  await showLine(line);
  if (skipMode) { await sleep(45); return; }
  $("#dlgNext").classList.add("on");
  await waitAdv();
}
/* 気になる言葉を選ばせる行 */
async function sayPick(c) {
  setSkip(false);
  const done = {}; let first = true;
  for (;;) {
    const tx = await showLine(c.l, { instant: !first }); first = false;
    $("#pickTip").classList.add("on");
    const picks = [...tx.querySelectorAll(".pick")];
    const k = await new Promise((res) => {
      picks.forEach((p) => {
        if (done[p.dataset.k]) { p.classList.add("done"); return; }
        p.classList.add("live");
        p.onclick = (e) => { e.stopPropagation(); Snd.sfx("tes"); res(p.dataset.k); };
      });
      if (done[c.ok]) { $("#dlgNext").classList.add("on"); $("#pickTip").classList.remove("on"); advResolve = () => res(null); }
    });
    advResolve = null; $("#pickTip").classList.remove("on");
    if (k === null) break;
    done[k] = true;
    await run(c.picks[k]);
    if (picks.every((p) => done[p.dataset.k])) break;
  }
}
function endDialogue() {
  $("#dlg").classList.remove("on"); $("#stage").classList.remove("scene"); setSprite(null);
  $("#pickTip").classList.remove("on");
}

/* ================================================================ 台本を進める */
/* 台本のどこを読んでいるかを覚えておく（会話の途中でも、その場所から再開できるように）。
   SCENE_PATH：台本の配列 → その場所の名前（例 "SCENES.prologue"、"HS.music.piano"）。いちばん外側の場面だけを追う */
const SCENE_PATH = new Map();
(function walk(o, path, depth) {
  if (!o || typeof o !== "object" || depth > 8) return;
  if (Array.isArray(o)) SCENE_PATH.set(o, path);
  Object.keys(o).forEach((k) => walk(o[k], path + "." + k, depth + 1));
})({ SCENES, HS, TOPICS, PRESENT, DSCENE, AUTO }, "", 0);
function sceneAt(path) { let o = { SCENES, HS, TOPICS, PRESENT, DSCENE, AUTO }; for (const k of path.split(".").slice(1)) { if (o == null) return null; o = o[k]; } return Array.isArray(o) ? o : null; }
let runDepth = 0;
async function run(script, from = 0) {
  runDepth++;
  try {
    const path = runDepth === 1 ? SCENE_PATH.get(script) : null;
    for (let i = from; i < script.length; i++) {
      if (path && S.started && !S.bonus) {
        S.at = { p: path, i, bg: bgNow, snd: Snd.state, rs: rainStopped, dark: $("#stage").classList.contains("dark"), cast: cast.map((c) => c.id) };
        save(true);      // 1行ごとに、しるしを出さずに記録する
      }
      await step(script[i]); if (S.ended) return;
    }
  } finally { runDepth--; }
}
async function step(c) {
  if (typeof c === "string") return say(c);
  if (c.l) return sayPick(c);
  if (c.if !== undefined) return run(cond(c.if) ? (c.do || []) : (c.else || []));
  if (c.bg) { ["#chars", "#hs", "#hsuv"].forEach((i) => { $(i).innerHTML = ""; }); return setBg(c.bg); }
  if (c.bgm) {
    if (c.bgm === "rainoff") { rainStopped = true; $("#rain").classList.remove("on"); }
    else if (c.bgm !== "sad" && c.bgm !== "stop") rainStopped = false;
    return Snd.bgm(c.bgm);
  }
  if (c.sfx) return Snd.sfx(c.sfx);
  if (c.hide) return setSprite(null);
  if (c.cast) return c.cast.length ? setCast(c.cast) : clearCast();
  if (c.flag) { S.flags[c.flag] = 1; return; }
  if (c.ev) return getEvidence(c.ev, c.stage);
  if (c.tes) return getTestimony(c.tes);
  if (c.fx) return doFx(c.fx);
  if (c.chapter) return chapterCard(c.chapter);
  if (c.choice) return choice(c.q || null, c.choice.map((o) => o.x)).then((i) => run(c.choice[i].do || []));
  if (c.piano) return pianoGame();
  if (c.melody) return Snd.melody();
  if (c.doc) return showDoc(EVID[c.doc].doc);
  if (c.img) return showDoc(`<div class="bigimg" style="background-image:url(img/item/${c.img}.jpg${IMG_V})"></div>`);
  if (c.call) {
    if (c.call.startsWith("_topic:")) { const [, w, id] = c.call.split(":"); const t = TOPICS[w].find((x) => x.id === id); S.readT[w + "." + id] = 1; return run(t.s); }
    return run(SCENES[c.call]);
  }
  if (c.cut) return cutIn(c.cut);
  if (c.life) { lifeOn = c.life === "on"; lifeN = 5; drawLife(); return; }
  if (c.checkpoint) { S.cp = c.checkpoint; save(); return run(SCENES[c.checkpoint]); }
  if (c.recon) return reconScene(c.recon);
  if (c.dark !== undefined) { $("#stage").classList.toggle("dark", !!c.dark); return; }
  if (c.present) return askPresent(c.present);
  if (c.quiz) return askQuiz(c.quiz);
  if (c.accuse) return askAccuse(c.accuse);
  if (c.deduce) return deduceFx(c.deduce, c.a, c.b);
  if (c.end) { S.ended = c.end === 1 ? "true" : c.end; return; }
}
async function doFx(name) {
  if (name === "thunder") { Snd.sfx("thunder"); flash("white"); shake(); await sleep(skipMode ? 50 : 500); }
  else if (name === "shake") { Snd.sfx("thud"); shake(); await sleep(skipMode ? 50 : 300); }
  else if (name === "flash") { flash("white"); await sleep(200); }
  else if (name === "fade") await fade();
  else if (name === "uvon") { Snd.sfx("uv"); $("#stage").classList.add("uvon"); $("#uv").style.setProperty("--mx", "50%"); $("#uv").style.setProperty("--my", "60%"); }
  else if (name === "uvoff") $("#stage").classList.remove("uvon");
}

/* 場面をひとつ流して、終わったら元の画面へ */
async function play(script, then, from) {
  mode = "scene"; closeMenu(); setUV(false);
  ["#hud", "#actions", "#idleTip"].forEach((i) => $(i).classList.add("off"));
  await run(script, from || 0);
  setSkip(false);
  if (S.ended) return showEnding();
  await checkAuto();
  endDialogue(); mode = "idle";
  if (then) then(); else idle();
}
async function checkAuto() {
  for (let again = true; again;) {
    again = false;
    for (const a of AUTO) if (!S.auto[a.id] && cond(a.c)) { S.auto[a.id] = 1; await run(a.s); again = true; }
  }
}

/* ================================================================ 入手の演出 */
async function fxPanel(node, minMs = 350) {
  const fx = $("#fx"); fx.innerHTML = ""; fx.appendChild(node); fx.classList.add("block");
  setSkip(false);
  await sleep(minMs); await waitAdv();
  fx.classList.remove("block"); fx.innerHTML = "";
}
async function getEvidence(id, stage) {
  const e = EVID[id], st = stage || 0, isNew = !has(id);
  if (!isNew && (S.evStage[id] || 0) >= st) return;
  if (isNew) { S.ev.push(id); S.flags[id] = 1; }
  S.evStage[id] = st; S.fresh[id] = 1; markNoteNew();
  Snd.sfx("get"); flash("white");
  const lab = e.tool ? "道具を入手" : (isNew ? "証拠品を入手" : "証拠品を更新");
  const n = el("div", "get" + (e.tool ? " tool" : "") + (isNew ? "" : " up"),
    `<div class="rays"></div><div class="band"></div><div class="card"><div class="pic" style="background-image:url(img/item/${e.img}.jpg${IMG_V})"></div>
     <div class="txt"><span class="lab">${lab}</span><h2>${e.name}</h2><p>${kwHtml(e.stages[st])}</p></div></div><div class="tap">クリックで進む</div>`);
  await fxPanel(n, 500);
}
async function getTestimony(id) {
  if (has(id)) return;
  const t = TESTI[id], c = CHARS[t.who];
  S.tes.push(id); S.flags[id] = 1; S.fresh[id] = 1; markNoteNew();
  Snd.sfx("tes");
  const n = el("div", "tesfx", `<div class="slash"></div><div class="in"><div class="fc"></div><div><span class="lab">証言を記録</span>
    <h2>${t.name}<small>${c.name}</small></h2><p>「${kwHtml(t.text)}」</p></div></div><div class="tap">クリックで進む</div>`);
  n.querySelector(".fc").appendChild(faceEl(t.who, 150));
  await fxPanel(n, 400);
}
async function chapterCard(c) {
  Snd.sfx("chapter");
  const n = el("div", "chap", `<div class="in"><div class="no">${c.no}</div><h2>${c.title}</h2><div class="ln"></div></div>`);
  const fx = $("#fx"); fx.innerHTML = ""; fx.appendChild(n); fx.classList.add("block");
  endDialogue(); $("#hud").classList.add("off"); $("#actions").classList.add("off");
  let over = false;       // 時間切れのあとで、クリック待ちを作ってしまわないように
  await Promise.race([sleep(skipMode ? 500 : 3000), sleep(900).then(() => (over ? null : waitAdv()))]);
  over = true; advResolve = null; n.classList.add("out"); await sleep(450);
  fx.classList.remove("block"); fx.innerHTML = "";
}
async function cutIn(text) {
  Snd.sfx("cut"); flash("white"); shake();
  const n = el("div", "cut", `<div class="bar"></div><b>${text}</b>`);
  const fx = $("#fx"); fx.innerHTML = ""; fx.appendChild(n);
  await sleep(1300); fx.innerHTML = "";
}
function showDoc(html) {
  return new Promise((res) => {
    const o = $("#docOv"); o.innerHTML = html + '<div class="doc-tip">クリックで閉じる</div>'; o.classList.add("on"); Snd.sfx("open");
    o.onclick = () => { o.classList.remove("on"); o.onclick = null; Snd.sfx("close"); res(); };
  });
}

/* ================================================================ 選択肢 */
function choice(q, opts) {
  return new Promise((res) => {
    setSkip(false);
    const box = $("#choices"); box.innerHTML = q ? `<div class="q">${kwHtml(q)}</div>` : "";
    opts.forEach((x, i) => {
      const b = el("button", "ch", `<span>${kwHtml(x)}</span>`); b.style.animationDelay = i * 0.07 + "s";
      b.onmouseenter = () => Snd.sfx("hover");
      b.onclick = () => { Snd.sfx("click"); box.classList.remove("on"); res(i); };
      box.appendChild(b);
    });
    box.classList.add("on");
  });
}

/* ================================================================ 最後の推理：問い */
function drawLife() {
  const l = $("#life"); l.classList.toggle("on", lifeOn);
  l.innerHTML = "<b>確信</b>" + [0, 1, 2, 3, 4].map((i) => `<i class="${i < lifeN ? "" : "lost"}"></i>`).join("");
}
async function wrongAnswer(q, tries) {
  S.mistakes++; lifeN--; Snd.sfx("life"); shake(); drawLife();
  $("#life").classList.add("hit"); setTimeout(() => $("#life").classList.remove("hit"), 450);
  await run(q.wrong || ["me: （……違う。もう一度、考え直そう）"]);
  if (lifeN <= 0) await run(has("act2") ? SCENES.end_lifeout2 : SCENES.end_lifeout);   // 確信が尽きた → 結末「濡れ衣」（第二幕では「半分の真相」）
  else if (tries >= 2 && q.hint) await run(["hiyori/think: （ミナト。" + q.hint + "）"]);
}
async function askPresent(q) {
  for (let tries = 1; ; tries++) {
    endDialogue(); $("#hud").classList.add("off");
    const id = await openNote({ select: true, q: q.q, force: true });
    if (q.ok.some((o) => o.split("@")[0] === id && okItem(o))) { Snd.sfx("ok"); return; }
    await wrongAnswer(q, tries);
    if (S.ended) return;
  }
}
async function askQuiz(q) {
  for (let tries = 1; ; tries++) {
    const i = await choice(q.q, q.opts);
    if (i === q.ok) { Snd.sfx("ok"); return; }
    await wrongAnswer(q, tries);
    if (S.ended) return;
  }
}
async function askAccuse(q) {
  for (let tries = 1; ; tries++) {
    endDialogue();
    const id = await new Promise((res) => {
      const o = $("#accuseOv"); o.innerHTML = `<div class="ov-q"><span>${q.q}</span></div><div id="accGrid"></div>`;
      const list = q.list || SUSPECTS;
      list.forEach((s, i) => {
        const c = CHARS[s], b = el("button", "acc", `<img src="${spriteSrc(s)}" alt=""><b><span>${c.name}</span></b>`);
        const im = b.querySelector("img"); placeSprite(im, s, 560, 138); im.style.transform = "skewX(8deg)";
        if (list.length > 5) { b.style.width = Math.floor((1190 - 16 * (list.length - 1)) / list.length) + "px"; b.querySelector("b").style.fontSize = "16px"; }
        b.style.setProperty("--c", c.color); b.style.animationDelay = i * 0.08 + "s";
        b.onmouseenter = () => Snd.sfx("hover");
        b.onclick = () => { o.classList.remove("on"); res(s); };
        o.querySelector("#accGrid").appendChild(b);
      });
      o.classList.add("on");
    });
    if (id === q.ok) { Snd.sfx("ok"); return; }
    if (q.soft) { await wrongAnswer(q, tries); if (S.ended) return; continue; }   // 第二幕の指名は、ふつうの誤答として扱う
    // まちがった相手：相棒が止める。それでも押し通すと、結末「誤認」
    S.accused = id;
    await run(q.wrong || []);
    if (tries >= 2 && q.hint) await run(["hiyori/think: （ミナト。" + q.hint + "）"]);
    const go = await choice(CHARS[id].name.replace(" ", "") + "を、犯人として名指しする？", ["考え直す", "それでも、この人が犯人だ"]);
    if (go === 1) { S.flags["acc_" + id] = 1; await run(SCENES.end_wrong); return; }
    S.accused = null;
  }
}

/* ================================================================ 探索（待ち受け） */
function objectiveText() { for (const [c, t] of OBJECTIVES) if (cond(c)) return t; return ""; }
function hintText() { for (const [c, t] of HINTS) if (cond(c)) return t; return "いまは、気になるところを自由に調べてみよう。"; }
function locChars(id) { return (LOCS[id].chars || []).filter((c) => cond(c.c)); }
function topicsOf(who) { return (TOPICS[who] || []).filter((t) => cond(t.c)); }
function locHasNew(id) {
  const L = LOCS[id];
  if (L.hs.some((h) => !h.uv && cond(h.c) && !S.seenHs[id + "." + h.id])) return true;
  if (has("uv_ready") && L.hs.some((h) => h.uv && uvVisible(id, h) && !S.seenHs[id + "." + h.id])) return true;
  return locChars(id).some((c) => topicsOf(c.id).some((t) => !S.readT[c.id + "." + t.id]));
}
function uvVisible(loc, h) { return cond(h.c) && !(loc === "broadcast" && !has("ren_ok")); }

function idle() {
  mode = "idle"; endDialogue(); closeMenu(); S.at = null; save();
  const L = LOCS[S.loc];
  setBg(L.bg);
  $("#hud").classList.remove("off"); $("#actions").classList.remove("off"); $("#idleTip").classList.remove("off");
  $("#locSub").textContent = L.sub; $("#locName").textContent = L.name;
  const ot = objectiveText(), oe = $("#objText");
  if (oe.dataset.t !== ot) { oe.dataset.t = ot; oe.innerHTML = kwHtml(ot); const o = $("#objective"); o.classList.remove("flash"); void o.offsetWidth; o.classList.add("flash"); }
  $("#btnUV").classList.toggle("have", has("uv_ready"));
  drawClock();
  const rd = markThink(); S.dedTold = S.dedTold || {};
  // 話の食いちがいが新しく見つかったら、《再現》を見るよう知らせる
  const rcc = rcClashes().map(([, id]) => id); S.rcTold = S.rcTold || {};
  if (rcc.some((id) => !S.rcTold[id]) && S.flags.tut_clock && !rd.some((id) => !S.dedTold[id])) { rcc.forEach((id) => { S.rcTold[id] = 1; }); setTimeout(() => toast("話の合わない人がいる。《捜査メモ》の《再現》で確かめよう", 3600), 500); }
  if (rd.some((id) => !S.dedTold[id]) && S.flags.tut_clock) { rd.forEach((id) => { S.dedTold[id] = 1; }); setTimeout(() => toast("手がかりがそろった。《捜査メモ》の《推理》で結べそうだ", 3600), 500); }
  if (!S.flags.tut_clock) { S.flags.tut_clock = 1; setTimeout(() => toast("《移動する》たびに時間が進む。警察の到着は《20時30分》", 4200), 900); }
  const cs = locChars(S.loc);
  $("#actTalk").disabled = !cs.length; $("#actPresent").disabled = !cs.length || !(S.ev.length + S.tes.length);
  $("#actGather").classList.toggle("on", has("ready") && S.loc === "classroom");
  $("#idleTip").innerHTML = cs.length ? "<b>◆</b> 光る場所を調べる　<b>●</b> 人物をクリックで話す" : "<b>◆</b> 光る場所を調べる";
  drawChars(); drawHotspots(); markNoteNew();
  Snd.bgm(has("ready") ? "tense" : "explore");
}
function drawChars() {
  const box = $("#chars"); box.innerHTML = "";
  locChars(S.loc).forEach((c) => {
    const ch = CHARS[c.id];
    const img = el("img", "lchar"); img.src = spriteSrc(c.id); img.style.left = c.x + "%"; img.alt = ch.name; placeSprite(img, c.id, 610, 300);
    img.onclick = () => { Snd.sfx("click"); talkMenu(c.id); };
    const unread = topicsOf(c.id).some((t) => !S.readT[c.id + "." + t.id]);
    const tag = el("div", "lchar-tag", ch.name + (unread ? "<i>NEW</i>" : "")); tag.style.left = c.x + "%"; tag.style.setProperty("--c", ch.color);
    box.appendChild(img); box.appendChild(tag);
  });
}
function drawHotspots() {
  const a = $("#hs"), b = $("#hsuv"); a.innerHTML = ""; b.innerHTML = "";
  LOCS[S.loc].hs.forEach((h) => {
    if (!cond(h.c)) return;
    if (h.uv && !uvVisible(S.loc, h)) return;
    const key = S.loc + "." + h.id;
    const d = el("div", "hs" + (h.uv ? " uvh" : "") + (S.seenHs[key] ? " seen" : ""), `<span>${h.label}</span>`);
    d.style.cssText = `left:${h.x}%;top:${h.y}%;width:${h.w}%;height:${h.h}%`;
    d.onmouseenter = () => Snd.sfx("hover");
    d.onclick = (e) => { e.stopPropagation(); if (mode !== "idle") return; Snd.sfx("click"); S.seenHs[key] = 1; play(HS[key] || ["n: 特に変わったところはない。"]); };
    (h.uv ? b : a).appendChild(d);
  });
  b.style.display = S.uv ? "" : "none";
}
function setUV(on) {
  if (!S) return;
  S.uv = !!on && has("uv_ready");
  $("#stage").classList.toggle("uvon", S.uv); $("#btnUV").classList.toggle("on", S.uv);
  $("#hsuv").style.display = S.uv ? "" : "none";
}
$("#btnUV").onclick = () => { if (mode !== "idle") return; Snd.sfx("uv"); setUV(!S.uv); if (S.uv) toast("ブラックライト点灯。《光る跡》を探そう"); };
function uvMove(cx, cy) {
  if (!S || !S.uv) return;
  const [x, y] = stagePos(cx, cy);
  $("#uv").style.setProperty("--mx", (x / 1280 * 100) + "%"); $("#uv").style.setProperty("--my", (y / 720 * 100) + "%");
}
$("#stage").addEventListener("mousemove", (e) => uvMove(e.clientX, e.clientY));
["touchstart", "touchmove"].forEach((t) => $("#stage").addEventListener(t, (e) => { const p = e.touches[0]; if (p) uvMove(p.clientX, p.clientY); }, { passive: true }));

/* ---------- 話す */
/* 一覧が画面の下にはみ出さないように、実際の高さを測って詰める。
   ふつう → おさまらなければ字と間を小さく → それでもだめなら2列。いちばん下の「つきつける」「話を終える」を、かならず押せるようにする */
function menuFit(bottom) {   // bottom＝話題の一覧。いつも3列で画面の下にならべる
  const m = $("#menu"), over = () => m.offsetTop + m.offsetHeight > 700;
  m.classList.add("nofx");            // 測るあいだは、大きさがゆっくり変わる動きを止める（止めないと、変わる前の高さを測ってしまう）
  m.classList.remove("tight", "wide");
  if (bottom || over()) { m.classList.add("wide"); if (m.offsetTop < 96) m.classList.add("tight"); }
  void m.offsetHeight; m.classList.remove("nofx");
}
function closeMenu() { $("#menu").classList.remove("on"); }
function pickPerson(cb) {
  const cs = locChars(S.loc);
  if (cs.length === 1) return cb(cs[0].id);
  const m = $("#menu"); m.innerHTML = '<div class="m-h">誰に？</div>'; mode = "menu";
  cs.forEach((c) => { const b = el("button", "mi", `<span>${CHARS[c.id].name}</span>`); b.onclick = () => { Snd.sfx("click"); cb(c.id); }; m.appendChild(b); });
  const x = el("button", "mi back", "<span>やめる</span>"); x.onclick = () => { Snd.sfx("close"); idle(); }; m.appendChild(x);
  m.classList.add("on"); menuFit(); $("#actions").classList.add("off");
}
function talkMenu(who) {
  if (mode !== "idle" && mode !== "menu") return;
  mode = "menu"; setUV(false);
  const ch = CHARS[who], m = $("#menu");
  $("#stage").classList.add("scene"); setSprite(who, "normal"); $("#actions").classList.add("off"); $("#idleTip").classList.add("off");
  m.style.setProperty("--c", ch.color);
  m.innerHTML = `<div class="m-h"><b>${ch.name}</b>に聞く</div>`;
  topicsOf(who).forEach((t, i) => {
    const key = who + "." + t.id, read = S.readT[key];
    const b = el("button", "mi " + (read ? "read" : "new"), `<span>${t.label}</span>`); b.style.animationDelay = i * 0.04 + "s";
    b.onmouseenter = () => Snd.sfx("hover");
    b.onclick = () => { Snd.sfx("click"); S.readT[key] = 1; const s = typeof t.s === "string" ? SCENES[t.s] : t.s; play(s, () => talkMenu(who)); };
    m.appendChild(b);
  });
  const p = el("button", "mi sp", "<span>つきつける</span>");
  p.onclick = () => { Snd.sfx("click"); presentTo(who); }; m.appendChild(p);
  const x = el("button", "mi back", "<span>話を終える</span>"); x.onclick = () => { Snd.sfx("close"); idle(); }; m.appendChild(x);
  m.classList.add("on"); menuFit(true);
}
async function presentTo(who) {
  closeMenu();
  const id = await openNote({ select: true, q: `${CHARS[who].name}に、何をつきつける？` });
  if (!id) return talkMenu(who);
  const P = PRESENT[who] || {};
  play(P[id] || P._ || ["n: 反応はなかった。"], () => talkMenu(who));
}
$("#actTalk").onclick = () => { Snd.sfx("click"); pickPerson(talkMenu); };
$("#actPresent").onclick = () => { Snd.sfx("click"); pickPerson(presentTo); };
$("#actGather").onclick = async () => {
  Snd.sfx("click"); mode = "menu"; $("#actions").classList.add("off");
  const i = await choice("全員を教室に集め、最後の推理を始める。", ["始める", "まだ調べる"]);
  if (i === 0) play(SCENES.showdown); else idle();
};

/* ---------- 相棒 */
$("#btnHint").onclick = () => {
  if (mode !== "idle") return;
  Snd.sfx("click"); S.hints++;
  const chat = HIYORI_CHAT[S.chat++ % HIYORI_CHAT.length];
  const rd = readyDeds(), rm = MYSTERIES.find((m) => rd.includes(m.solved) && cond(m.show));
  const lead = rd.length ? ["hiyori/smile: 手がかりは、もうそろってるよ。《捜査メモ》の《推理》を開いてみて。" + (rm ? "「" + rm.q + "」――これ、いまなら解けると思う。" : ""),
    "hiyori/think: 光ってる手がかりを、ふたつ選んで《結ぶ》。ひとつ選ぶと、相手になるほうが光るからね。"] : ["hiyori/think: " + hintText()];
  play([...lead, ...(S.hints % 3 === 0 ? [chat] : [])]);
};

/* ---------- 移動 */
function openMap() {
  if (mode !== "idle") return;
  Snd.sfx("open"); setUV(false);
  const o = $("#mapOv");
  o.innerHTML = `<div class="ov-h"><b>校内図</b><span>SCHOOL MAP</span></div><button class="ov-x">とじる</button><div id="mapBody"><svg viewBox="0 0 960 560"></svg></div>
    <div id="mapLegend">行き先をクリックで移動<i></i>まだ調べていないこと・聞いていない話がある</div>`;
  const body = o.querySelector("#mapBody"), svg = o.querySelector("svg");
  MAP_BLOCKS.forEach((b) => { const d = el("div", "mblock", `<span>${b.name}</span>`); d.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`; body.appendChild(d); });
  svg.innerHTML = MAP_LINKS.map(([a, b]) => { const p = LOCS[a].map, q = LOCS[b].map; return `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#5a69be" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>`; }).join("");
  Object.entries(LOCS).forEach(([id, L]) => {
    const n = el("button", "mnode" + (id === S.loc ? " here" : ""), `<b>${L.name.replace("2年B組の", "2-B ")}</b><small>${id === S.loc ? "現在地" : L.sub}</small>`);
    n.style.left = L.map[0] + "px"; n.style.top = L.map[1] + "px";
    if (locHasNew(id)) n.appendChild(el("i", "dot"));
    const fs = el("div", "faces"); locChars(id).forEach((c) => fs.appendChild(faceEl(c.id, 30))); n.appendChild(fs);
    n.onmouseenter = () => Snd.sfx("hover");
    n.onclick = async () => {
      o.classList.remove("on"); if (id === S.loc) return; Snd.sfx("step"); mode = "scene"; await fade(); S.loc = id;
      S.clock = (S.clock || 0) + 1;                       // 移動のたびに時間が進む
      if (S.clock >= CLOCK_LIMIT) return play(SCENES.end_timeout);
      let msg = null;
      while ((S.warn || 0) < CLOCK_WARN.length && S.clock >= CLOCK_WARN[S.warn || 0][0]) { msg = CLOCK_WARN[S.warn || 0][1]; S.warn = (S.warn || 0) + 1; }
      if (msg) { setBg(LOCS[id].bg); return play([msg]); }
      idle();
    };
    body.appendChild(n);
  });
  o.querySelector(".ov-x").onclick = () => { Snd.sfx("close"); o.classList.remove("on"); };
  o.classList.add("on");
}
$("#actMove").onclick = openMap;

/* ================================================================ 捜査メモ */
let noteTab = "ev", noteSel = null, noteOpt = null, noteRes = null, pfSel = "kotone", slots = [null, null], lgMsg = "";
const NOTE_TABS = [["ev", "証拠品", "EVIDENCE"], ["tes", "証言", "TESTIMONY"], ["pf", "人物", "PROFILE"], ["rel", "相関図", "RELATION"], ["tl", "時系列", "TIMELINE"], ["rc", "再現", "REPLAY"], ["lg", "推理", "LOGIC"]];
function markNoteNew() {
  const n = Object.keys(S.fresh).length, e = $("#noteNew");
  e.textContent = n; e.classList.toggle("on", n > 0);
}
function openNote(opt = {}) {
  return new Promise((res) => {
    noteOpt = opt; noteRes = res; setUV(false);
    if (opt.select && (noteTab !== "ev" && noteTab !== "tes")) noteTab = "ev";
    if (opt.tab) noteTab = opt.tab;
    Snd.sfx("open"); drawNote(); $("#noteOv").classList.add("on");
  });
}
function closeNote(val) { Snd.think(false); rcStop(); $("#noteOv").classList.remove("on"); const r = noteRes; noteRes = null; if (r) r(val || null); }
function drawNote() {
  Snd.think(noteTab === "lg");   // 推理のページを開いているあいだは、考える曲
  rcStop();
  const o = $("#noteOv"), sel = noteOpt.select;
  o.innerHTML = (sel ? `<div class="ov-q"><span>${kwHtml(noteOpt.q)}</span></div>` : `<div class="ov-h"><b>捜査メモ</b><span>CASE NOTE</span></div>`) +
    (noteOpt.force ? "" : `<button class="ov-x">${sel ? "やめる" : "とじる"}</button>`) + `<div id="noteWrap"><div id="noteTabs"></div><div id="notePage"><div class="npad"></div></div></div>`;
  const tabs = o.querySelector("#noteTabs");
  NOTE_TABS.forEach(([id, name, en]) => {
    if (sel && id !== "ev" && id !== "tes") return;
    const fresh = id === "ev" ? S.ev.some((x) => S.fresh[x]) : id === "tes" ? S.tes.some((x) => S.fresh[x]) : id === "lg" ? !sel && readyDeds().length > 0 : false;
    const b = el("button", "ntab" + (id === noteTab ? " on" : ""), `${name}<small>${en}</small><em class="${fresh ? "on" : ""}"></em>`);
    b.onclick = () => { Snd.sfx("click"); noteTab = id; drawNote(); }; tabs.appendChild(b);
  });
  const x = o.querySelector(".ov-x"); if (x) x.onclick = () => { Snd.sfx("close"); closeNote(null); };
  const pad = o.querySelector(".npad");
  ({ ev: pageEv, tes: pageTes, pf: pagePf, rel: pageRel, tl: pageTl, rc: pageRc, lg: pageLg })[noteTab](pad);
}
function pageEv(pad) {
  if (!S.ev.length) { pad.innerHTML = '<div class="empty">まだ証拠品はない。現場を調べよう。</div>'; return; }
  const sel = noteOpt.select;
  const list = S.ev.filter((id) => !(sel && EVID[id].tool));
  if (!noteSel || !list.includes(noteSel)) noteSel = list[list.length - 1];
  const wrap = el("div", "ev-wrap"), grid = el("div", "ev-grid"), det = el("div", "ev-detail");
  const addSec = (title, ids) => {
    if (!ids.length) return;
    grid.appendChild(el("div", "ev-sec", title));
    ids.forEach((id) => {
      const e = EVID[id];
      const c = el("button", "evc" + (e.tool ? " tool" : "") + (id === noteSel ? " on" : ""), `<img src="img/item/${e.img}.jpg${IMG_V}" alt=""><b>${e.name}</b>` + (S.fresh[id] ? '<i class="nw">NEW</i>' : ""));
      c.onclick = () => { Snd.sfx("click"); noteSel = id; delete S.fresh[id]; markNoteNew(); drawNote(); };
      grid.appendChild(c);
    });
  };
  addSec("証拠品", list.filter((id) => !EVID[id].tool)); addSec("道具", list.filter((id) => EVID[id].tool));
  if (noteSel) {
    const e = EVID[noteSel], st = S.evStage[noteSel] || 0;
    delete S.fresh[noteSel];
    det.innerHTML = `<div class="pic" style="background-image:url(img/item/${e.img}.jpg${IMG_V})"></div><h3>${e.name}</h3><p>${kwHtml(e.stages[st])}</p><div class="ev-btns"></div>`;
    const btns = det.querySelector(".ev-btns");
    if (e.doc && st >= (e.docStage || 0)) { const b = el("button", "nbtn", "<span>よく見る</span>"); b.onclick = () => showDoc(e.doc); btns.appendChild(b); }
    if (!sel && e.use && st === 0 && has(e.use.tool)) {
      const b = el("button", "nbtn use", `<span>${e.use.label}</span>`);
      b.onclick = () => { Snd.sfx("click"); closeNote(null); play(SCENES[e.use.scene]); }; btns.appendChild(b);
    }
    if (sel) { const b = el("button", "nbtn hot", "<span>これをつきつける</span>"); b.onclick = () => { Snd.sfx("click"); closeNote(noteSel); }; btns.appendChild(b); }
  }
  wrap.appendChild(grid); wrap.appendChild(det); pad.appendChild(wrap);
}
function pageTes(pad) {
  if (!S.tes.length) { pad.innerHTML = '<div class="empty">まだ証言はない。関係者に話を聞こう。</div>'; return; }
  const sel = noteOpt.select;
  S.tes.forEach((id) => {
    const t = TESTI[id], c = CHARS[t.who];
    const d = el("div", "tes" + (sel ? " sel" : ""), `<div class="fc"></div><div><h4>${t.name}<small>${c.name}</small></h4><p>「${kwHtml(t.text)}」</p></div>` + (S.fresh[id] ? '<i class="nw">NEW</i>' : ""));
    d.style.setProperty("--c", c.color); d.querySelector(".fc").appendChild(faceEl(t.who, 62));
    if (sel) d.onclick = () => { Snd.sfx("click"); closeNote(id); };
    pad.appendChild(d); delete S.fresh[id];
  });
  markNoteNew();
}
function pagePf(pad) {
  const ids = ["kotone", "rena", "uta", "marika", "taiga", "ren", "makabe", "koga", "hiyori"];
  const wrap = el("div", "pf-wrap"), list = el("div", "pf-list"), main = el("div", "pf-main");
  ids.forEach((id) => {
    const c = CHARS[id], b = el("button", "pf-i" + (id === pfSel ? " on" : "")); b.style.setProperty("--c", c.color);
    b.appendChild(faceEl(id, 40)); b.appendChild(el("span", "", c.short)); b.onclick = () => { Snd.sfx("click"); pfSel = id; drawNote(); }; list.appendChild(b);
  });
  const c = CHARS[pfSel]; main.style.setProperty("--c", c.color);
  main.innerHTML = `<img class="pf-pic${pfSel === "kotone" ? " gone" : ""}" src="${spriteSrc(pfSel)}" alt=""><div class="pf-txt"><span class="role">${c.role}</span><h3>${c.name}</h3><div class="kana">${c.kana}${c.height ? "　／　身長 " + c.height + "cm" : ""}</div><ul>` +
    c.profile.filter((p) => cond(p.c)).map((p) => `<li>${kwHtml(p.text)}</li>`).join("") + "</ul></div>";
  wrap.appendChild(list); wrap.appendChild(main); pad.appendChild(wrap);
}
function pageRel(pad) {
  const wrap = el("div"); wrap.id = "relWrap";
  let svg = '<svg id="relSvg" viewBox="0 0 900 500" style="position:absolute;left:0;top:0;margin:0">';
  REL_EDGES.forEach((e) => {
    if (!cond(e.c)) return;
    let text = e.text, hot = false;
    (e.up || []).forEach((u) => { if (cond(u.c)) { text = u.text; hot = true; } });
    const [x1, y1] = REL_NODES[e.a], [x2, y2] = REL_NODES[e.b];
    const t = e.t || 0.5, mx = x1 + (x2 - x1) * t, my = y1 + (y2 - y1) * t;
    svg += `<line class="edge${hot ? " hot" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text class="elabel${hot ? " hot" : ""}" x="${mx}" y="${my + 5}">${text}</text>`;
  });
  wrap.innerHTML = svg + "</svg>";
  Object.entries(REL_NODES).forEach(([id, [x, y]]) => {
    const c = CHARS[id], n = el("div", "rnode" + (id === "kotone" ? " victim" : "") + (id === "me" ? " me" : "")); n.style.left = x + "px"; n.style.top = y + "px"; n.style.setProperty("--c", c.color);
    const f = faceEl(id, id === "kotone" ? 92 : 70); if (id === "me") f.textContent = pname().mei.slice(0, 1); n.appendChild(f); n.appendChild(el("b", "", c.short || c.name)); wrap.appendChild(n);
  });
  pad.appendChild(wrap);
}
function pageTl(pad) {
  let h = '<table class="tl"><tr><th></th>' + TL_COLS.map((c) => `<th>${c}</th>`).join("") + "</tr>";
  TL_ROWS.forEach((r) => {
    const c = CHARS[r.id];
    h += `<tr><td class="who" style="--c:${c.color}">${c.short}</td>` + r.cells.map((cell) => "<td>" + cell.filter((x) => cond(x.c)).map((x) => `<span class="${x.k || ""}">${x.t}</span>`).join("") + "</td>").join("") + "</tr>";
  });
  pad.style.overflowY = "auto";
  pad.innerHTML = h + '</table><div class="tl-note">話を聞くほど埋まっていく。<i style="background:var(--cyan)"></i>裏づけあり<i style="background:var(--gold)"></i>本人の話だけ<i style="background:var(--rose)"></i>重要</div>';
}

/* ================================================================ 再現
   聞いた話・見つけた物をもとに、「何時に、誰が、どこにいたか」を校内図の上に置く。
   時刻を動かすと人が動く。本人の話だけの人は点線、裏づけのある人は実線、話が食いちがう人には「!」がつく */
const RC_KIND = { ok: "裏づけあり", say: "話だけ", q: "疑わしい", lie: "居場所不明", dead: "――", true: "判明", none: "情報なし" };
const hm = (s) => +s.slice(0, 2) * 60 + +s.slice(3);
const mh = (t) => Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
let rcT = 17 * 60, rcSel = null, rcPlay = null;
function rcStop() { if (rcPlay) { clearInterval(rcPlay); rcPlay = null; } }
function rcAt(id, t) {
  let win = null, said = null;
  for (const [a, b, spot, c, kind, note] of RC_SEG[id]) {
    if (t < hm(a) || t >= hm(b) || !cond(c)) continue;
    win = { spot, kind, note, from: hm(a) };
    if (kind === "say") said = win;
  }
  if (!win) return { spot: null, kind: "none", note: "この時刻のことは、まだ誰からも聞いていない。" };
  if (said && said !== win && win.kind === "ok" && win.spot !== said.spot) win.clash = said;
  return win;
}
/* 話の食いちがい（はじまりの時刻だけ） */
function rcClashes() {
  const out = [];
  RC_WHO.forEach(([id]) => { let prev = false; for (let t = RC_T0; t <= RC_T1; t++) { const c = !!rcAt(id, t).clash; if (c && !prev) out.push([t, id]); prev = c; } });
  return out.sort((a, b) => a[0] - b[0]);
}
const rcName = (id) => (id === "me" ? CHARS.me.short + "とひより" : CHARS[id].short);
function rcBuild(host, opt = {}) {
  rcStop();
  if (opt.at !== undefined) rcT = opt.at;
  rcT = Math.max(RC_T0, Math.min(RC_T1, rcT));
  let ticks = "";
  for (let t = RC_T0; t <= RC_T1; t += 5) ticks += `<button class="rc-t${t % 30 === 0 ? " big" : ""}" data-t="${t}">${t % 30 === 0 ? "<i>" + mh(t) + "</i>" : ""}</button>`;
  host.innerHTML = `<div class="rc${opt.auto ? " auto" : ""}${opt.mini ? " mini" : ""}"><div class="rc-map"><svg viewBox="0 0 640 372">` +
    RC_BLOCKS.map(([nm, x, y, w, h]) => `<rect class="rc-blk" x="${x}" y="${y}" width="${w}" height="${h}"/><text class="rc-bn" x="${x + 8}" y="${y + 17}">${nm}</text>`).join("") +
    RC_LINKS.map(([a, b]) => { const p = RC_SPOTS[a], q = RC_SPOTS[b]; return `<line class="rc-ln" x1="${p[0]}" y1="${p[1] - 18}" x2="${q[0]}" y2="${q[1] - 18}"/>`; }).join("") +
    Object.entries(RC_SPOTS).map(([id, [x, y, nm]]) => `<g class="rc-spot" data-s="${id}"><rect x="${x - 47}" y="${y - 31}" width="94" height="25" rx="3"/><text x="${x}" y="${y - 13}">${nm}</text></g>`).join("") +
    `<text class="rc-tray" x="12" y="324">居場所がわからない人</text><circle class="rc-ring" cx="${RC_SPOTS.music[0]}" cy="${RC_SPOTS.music[1] - 6}" r="30"/><g class="rc-dots">` +
    RC_WHO.map(([id, ch]) => `<g class="rcd" data-id="${id}" style="--c:${CHARS[id].color}"><circle r="14"/><text y="5.5">${ch}</text><text class="bang" x="13" y="-7">!</text></g>`).join("") + `</g></svg></div>
    <div class="rc-side"><div class="rc-clock"><b></b><span>この時刻の居場所</span></div><div class="rc-evt"></div><div class="rc-list"></div><div class="rc-det"></div></div>
    <div class="rc-ctl"><button class="rc-b" data-d="-1">◀ 1分</button><div class="rc-ticks">${ticks}</div><button class="rc-b" data-d="1">1分 ▶</button><button class="rc-b play">▶ 再生</button></div>
    <div class="rc-keys"></div><div class="rc-cap"></div></div>`;
  const root = host.firstChild;
  const go = (t) => { rcT = Math.max(RC_T0, Math.min(RC_T1, t)); rcDraw(root); };
  root.querySelectorAll(".rc-t").forEach((b) => { b.onclick = () => { rcStop(); Snd.sfx("hover"); go(+b.dataset.t); }; });
  root.querySelectorAll(".rc-b[data-d]").forEach((b) => { b.onclick = () => { rcStop(); Snd.sfx("hover"); go(rcT + +b.dataset.d); }; });
  root.querySelectorAll(".rcd").forEach((g) => { g.onclick = () => { Snd.sfx("click"); rcSel = rcSel === g.dataset.id ? null : g.dataset.id; rcDraw(root); }; });
  const playBtn = root.querySelector(".rc-b.play");
  playBtn.onclick = () => {
    if (rcPlay) { rcStop(); rcDraw(root); return; }
    Snd.sfx("click"); if (rcT >= RC_T1) rcT = RC_T0;
    rcPlay = setInterval(() => { if (!root.isConnected || rcT >= RC_T1) { rcStop(); if (root.isConnected) rcDraw(root); return; } rcT++; rcSound(); rcDraw(root); }, 520);
    rcDraw(root);
  };
  // 注目の時刻：出来事と、話の食いちがい
  const keys = root.querySelector(".rc-keys"); keys.innerHTML = "<span>注目の時刻</span>";
  const seen = {};
  RC_EVENTS.filter((e) => cond(e[1])).forEach(([t, , nm]) => { if (seen[t + nm]) return; seen[t + nm] = 1; const b = el("button", "rc-k", `${t}<i>${nm}</i>`); b.onclick = () => { rcStop(); Snd.sfx("click"); go(hm(t)); }; keys.appendChild(b); });
  rcClashes().forEach(([t, id]) => { const b = el("button", "rc-k clash", `${mh(t)}<i>${CHARS[id].short}の話が食いちがう</i>`); b.onclick = () => { rcStop(); Snd.sfx("click"); rcSel = id; go(t); }; keys.appendChild(b); });
  rcDraw(root);
  return root;
}
function rcSound() {
  if (rcT === 17 * 60 || rcT === 18 * 60) Snd.sfx("chime");
  if (rcT === 17 * 60 + 30) Snd.melody();
  if (rcT === 17 * 60 + 3 && has("d_time")) Snd.sfx("thud");
}
function rcDraw(root) {
  const st = {}, groups = {};
  RC_WHO.forEach(([id]) => { st[id] = rcAt(id, rcT); const k = st[id].spot || "_"; (groups[k] = groups[k] || []).push(id); });
  root.querySelectorAll(".rc-spot").forEach((g) => g.classList.toggle("in", !!groups[g.dataset.s]));
  Object.entries(groups).forEach(([k, ids]) => ids.forEach((id, i) => {
    const g = root.querySelector(`.rcd[data-id="${id}"]`), s = st[id];
    let x, y;
    if (k === "_") { x = 28 + i * 32; y = 350; } else { const p = RC_SPOTS[k]; x = p[0] + (i - (ids.length - 1) / 2) * 30; y = p[1] + 11; }
    g.style.transform = `translate(${x}px,${y}px)`;
    g.setAttribute("class", "rcd k-" + s.kind + (s.clash ? " clash" : "") + (id === rcSel ? " sel" : ""));
  }));
  root.querySelector(".rc-clock b").textContent = mh(rcT);
  root.querySelector(".rc-ring").classList.toggle("on", (rcT === 17 * 60 + 30 || rcT === 17 * 60 + 31) && has("ch1"));
  // 自動で流すときの字幕：いま判明している動き
  root.querySelector(".rc-cap").innerHTML = RC_WHO.map(([id]) => { const s = st[id]; return s.kind === "true" || (s.kind === "dead" && rcT - s.from < 5) ? `<p><b style="color:${CHARS[id].color}">${CHARS[id].short}</b>${esc(s.note)}</p>` : ""; }).join("");
  // 出来事（その分ちょうどのものは強く、少し前のものは薄く）と、その分に判明した動き
  const evs = RC_EVENTS.filter((e) => cond(e[1]) && hm(e[0]) <= rcT && rcT - hm(e[0]) < 4);
  let h = evs.map((e) => `<p class="${hm(e[0]) === rcT ? "hot" : ""}"><b>${e[0]}</b>${e[3]}</p>`).join("");
  RC_WHO.forEach(([id]) => { const s = st[id]; if ((s.kind === "true" || s.kind === "dead") && s.from === rcT) h += `<p class="tr"><b>${CHARS[id].short}</b>${esc(s.note)}</p>`; });
  root.querySelector(".rc-evt").innerHTML = h || '<p class="dim">――</p>';
  const list = root.querySelector(".rc-list"); list.innerHTML = "";
  RC_WHO.forEach(([id, ch]) => {
    const s = st[id];
    const r = el("button", "rc-row k-" + s.kind + (s.clash ? " clash" : "") + (id === rcSel ? " sel" : ""),
      `<i style="--c:${CHARS[id].color}">${ch}</i><b>${rcName(id)}</b><span>${s.spot ? RC_SPOTS[s.spot][2] : "？"}</span><em>${s.clash ? "食いちがい" : RC_KIND[s.kind]}</em>`);
    r.onclick = () => { Snd.sfx("click"); rcSel = rcSel === id ? null : id; rcDraw(root); };
    list.appendChild(r);
  });
  const det = root.querySelector(".rc-det");
  if (rcSel) {
    const s = st[rcSel];
    det.innerHTML = `<b>${rcName(rcSel)}</b>${kwHtml(s.note)}` + (s.clash ? `<u>本人の話では《${RC_SPOTS[s.clash.spot][2]}》にいたはず。話が合わない。</u>` : "");
  } else det.innerHTML = '<span class="dim">人をえらぶと、その時刻の話が出る。点線は「話だけ」、実線は「裏づけあり」。</span>';
  root.querySelectorAll(".rc-t").forEach((b) => { const t = +b.dataset.t; b.classList.toggle("on", t <= rcT && rcT < t + 5); b.classList.toggle("past", t + 5 <= rcT); });
  root.querySelector(".rc-b.play").textContent = rcPlay ? "■ 止める" : "▶ 再生";
}
function pageRc(pad) { pad.style.overflow = "hidden"; pad.style.padding = "10px 22px"; rcBuild(pad); }
/* 台本から開く再現。{ recon: { at: "17:03", q: "…" } } は自分で動かせる。{ recon: { from, to, auto: 1 } } は自動で流れる */
function reconScene(o) {
  if (skipMode) return Promise.resolve();
  return new Promise((res) => {
    const ov = $("#reconOv");
    ov.innerHTML = `<div class="ov-h"><b>再現</b><span>REPLAY</span></div>` + (o.q ? `<div class="ov-q"><span>${kwHtml(o.q)}</span></div>` : "") + `<div id="rcBody"><div class="npad"></div></div><button class="nbtn hot" id="rcGo"><span>${o.auto ? "とばす" : "つづける"}</span></button>`;
    rcSel = null;
    const root = rcBuild(ov.querySelector(".npad"), { at: hm(o.at || o.from), auto: !!o.auto, mini: true });
    const done = () => { rcStop(); Snd.sfx("close"); ov.classList.remove("on"); ov.innerHTML = ""; res(); };
    $("#rcGo").onclick = done;
    ov.classList.add("on");
    if (o.auto) {
      const end = hm(o.to);
      setTimeout(() => {
        if (!root.isConnected) return;
        rcPlay = setInterval(() => {
          if (!root.isConnected) return rcStop();
          if (rcT >= end) { rcStop(); const b = $("#rcGo"); if (b) b.querySelector("span").textContent = "つづける"; return; }
          rcT++; rcSound(); rcDraw(root);
        }, 760);
      }, 900);
    }
  });
}
/* ---------- 推理への誘導：いま結べる組（まだ推理していないもので、ふたつとも手元にあるもの） */
const clueStageOk = (x) => (x === "trophy" ? (S.evStage.trophy || 0) >= 1 : x === "planner" ? (S.evStage.planner || 0) >= 1 : true);
const clueHave = (x) => (S.ev.includes(x) || S.tes.includes(x) || S.ded.includes(x)) && clueStageOk(x);
function readyPairs() {
  const out = [];
  for (const id of DEDUCT_ORDER) { if (has(id)) continue; DEDUCT[id].pairs.forEach(([p, q]) => { if (clueHave(p) && clueHave(q)) out.push([id, p, q]); }); }
  return out;
}
function readyDeds() { return [...new Set(readyPairs().map((r) => r[0]))]; }
function markThink() {
  const ids = readyDeds(); $("#btnNote").classList.toggle("think", ids.length > 0);
  return ids;
}
let lgFocus = null;
function clueName(id) { return EVID[id] ? EVID[id].name : TESTI[id] ? TESTI[id].name : DEDUCT[id].name; }
function pageLg(pad) {
  const wrap = el("div", "lg-wrap"), left = el("div", "lg-left"), right = el("div", "lg-right");
  left.innerHTML = '<div class="lg-h">解くべき謎</div>';
  const ms = MYSTERIES.filter((m) => cond(m.show));
  if (!ms.length) left.innerHTML += '<div class="empty" style="padding:20px">手がかりが集まると、ここに謎が浮かぶ。</div>';
  const rp = readyPairs(), rdy = [...new Set(rp.map((r) => r[0]))];
  if (lgFocus && !rdy.includes(lgFocus)) lgFocus = null;
  ms.forEach((m) => {
    const ok = has(m.solved), go = !ok && rdy.includes(m.solved);
    const d = el("div", "mys" + (ok ? " solved" : "") + (go ? " ready" : "") + (go && lgFocus === m.solved ? " focus" : ""),
      `<span>${m.q}</span>` + (ok ? `<q>${DEDUCT[m.solved].name}</q>` : `<small>${m.tip}</small>`) + (go ? `<em>手がかりはそろっている${lgFocus === m.solved ? "" : "　▶ 押すと候補をしぼる"}</em>` : ""));
    if (go) d.onclick = () => { Snd.sfx("click"); lgFocus = lgFocus === m.solved ? null : m.solved; slots = [null, null]; drawNote(); };
    left.appendChild(d);
  });
  // 光らせる手がかり：ひとつ選んだあとは「その相手」、選ぶ前は「結べる組に入っているもの」
  const use = lgFocus ? rp.filter((r) => r[0] === lgFocus) : rp;
  const one = slots[0] && !slots[1] ? slots[0] : null;
  const mates = one ? use.filter((r) => r[1] === one || r[2] === one).map((r) => (r[1] === one ? r[2] : r[1])) : [];
  const cands = one ? [] : [...new Set(use.flatMap((r) => [r[1], r[2]]))];
  const nm = (i) => slots[i] ? `<div><small>${EVID[slots[i]] ? "証拠品" : TESTI[slots[i]] ? "証言" : "推理"}</small>${clueName(slots[i])}</div>` : "手がかりを<br>えらぶ";
  right.innerHTML = `<div class="lg-h">ふたつの手がかりを結ぶ</div><div class="lg-slots"><div class="slot${slots[0] ? " fill" : ""}" data-i="0">${nm(0)}</div><span class="lg-x">×</span>
    <div class="slot${slots[1] ? " fill" : ""}" data-i="1">${nm(1)}</div><button class="nbtn hot lg-go" ${slots[0] && slots[1] ? "" : "disabled"}><span>結ぶ</span></button></div><div class="lg-msg">${lgMsg}</div><div class="chips"></div>`;
  lgMsg = "";
  right.querySelectorAll(".slot").forEach((s) => { s.onclick = () => { slots[+s.dataset.i] = null; Snd.sfx("close"); drawNote(); }; });
  const chips = right.querySelector(".chips");
  const add = (title, ids, cls) => {
    if (!ids.length) return;
    chips.appendChild(el("div", "chips-h", title));
    ids.forEach((id) => {
      const b = el("button", "chip " + cls + (slots.includes(id) ? " on" : mates.includes(id) ? " mate" : cands.includes(id) ? " cand" : ""), clueName(id));
      b.onclick = () => {
        Snd.sfx("click");
        const at = slots.indexOf(id);
        if (at >= 0) slots[at] = null; else if (!slots[0]) slots[0] = id; else if (!slots[1]) slots[1] = id; else slots = [slots[1], id];
        drawNote();
      };
      chips.appendChild(b);
    });
  };
  add("証拠品", S.ev.filter((id) => !EVID[id].tool), "e"); add("証言", S.tes, "t"); add("推理", S.ded, "d");
  right.querySelector(".lg-go").onclick = () => tryDeduce(wrap, right.querySelector(".lg-msg"));
  wrap.appendChild(left); wrap.appendChild(right); pad.appendChild(wrap);
}
function tryDeduce(wrap, msg) {
  const [a, b] = slots;
  const need = clueStageOk;
  let found = null, already = null;
  for (const id of DEDUCT_ORDER) {
    const hit = DEDUCT[id].pairs.some(([p, q]) => ((p === a && q === b) || (p === b && q === a)) && need(a) && need(b));
    if (hit) { if (has(id)) already = id; else { found = id; break; } }
  }
  if (!found) {
    Snd.sfx("wrong");
    lgMsg = already ? "その結びつきは、もう推理ずみだ。" : `「${clueName(a)}」と「${clueName(b)}」は、まだ結びつかない。`;
    slots = [null, null]; drawNote();
    const w = $(".lg-wrap"); if (w) w.classList.add("shake");
    return;
  }
  slots = [null, null]; closeNote(null);
  play([{ deduce: found, a, b }]);
}
async function deduceFx(id, a, b) {
  const d = DEDUCT[id];
  S.ded.push(id); S.flags[id] = 1;
  Snd.sfx("ded"); flash("white"); shake();
  const cr = [-24, 12, 58, -66, 34, 84].map((r, i) => `<div class="crack" style="--r:${r}deg;--d:${i * 0.04}s"></div>`).join("");
  const n = el("div", "dedfx", cr + `<div class="word">閃き</div><div class="box"><div class="lnk"><span>${clueName(a)}</span><i>×</i><span>${clueName(b)}</span></div>
    <h2>${d.name}</h2><p>${kwHtml(d.text)}</p></div><div class="tap">クリックで進む</div>`);
  await fxPanel(n, 1300);
  await run(DSCENE[id] || []);
}
$("#btnNote").onclick = () => { if (mode !== "idle" && mode !== "menu") return; openNote({}); };

/* ================================================================ ピアノ */
function pianoGame() {
  return new Promise((res) => {
    setSkip(false); endDialogue();
    const o = $("#pianoOv"), known = has("strings");
    o.innerHTML = `<div class="ov-h"><b>グランドピアノ</b><span>PIANO</span></div><button class="ov-x">はなれる</button>
      <div id="pianoBox"><h3>鍵盤を弾いてみる</h3><p>${known ? "《ラ》の弦は切れたままだ。" : "クリックで音が鳴る。ひとつずつ確かめよう。"}</p><div id="keys"><div id="keysIn"></div></div></div>`;
    const box = o.querySelector("#keysIn"), msg = o.querySelector("p");
    const whites = [["C4", "ド"], ["D4", "レ"], ["E4", "ミ"], ["F4", "ファ"], ["G4", "ソ"], ["A4", "ラ"], ["B4", "シ"], ["C5", "ド"]];
    const blacks = [["C#4", 0], ["D#4", 1], ["F#4", 3], ["G#4", 4], ["A#4", 5]];
    let closing = false;
    const finish = () => { if (closing) return; closing = true; o.classList.remove("on"); res(); };
    whites.forEach(([n, jp], i) => {
      const k = el("div", "wk" + (n === "A4" ? " deadkey" : ""), `<span>${jp}</span>`); k.style.left = i * 95 + "px";
      k.onmousedown = () => {
        k.classList.add("down"); setTimeout(() => k.classList.remove("down"), 160);
        if (n === "A4") {
          Snd.key(n, true); msg.textContent = "……コトン。《ラ》だけ、音が出ない。"; msg.className = "dead";
          if (!known && !has("piano_dead")) { S.flags.piano_dead = 1; setTimeout(finish, 1500); }
        } else Snd.key(n, false);
      };
      box.appendChild(k);
    });
    blacks.forEach(([n, i]) => { const k = el("div", "bk"); k.style.left = (i * 95 + 66) + "px"; k.onmousedown = () => Snd.key(n, false); box.appendChild(k); });
    o.querySelector(".ov-x").onclick = () => { Snd.sfx("close"); finish(); };
    o.classList.add("on");
  });
}

/* ================================================================ 記録・設定 */
/* 会話の記録。探索中は右上の「記録」、会話の途中はセリフ枠の「ログ」から開く */
function openLog() {
  if (mode !== "idle" && mode !== "scene") return;
  setSkip(false); Snd.sfx("open");
  const o = $("#logOv");
  o.innerHTML = `<div class="ov-h"><b>会話の記録</b><span>LOG</span></div><button class="ov-x">とじる</button><div id="logBody"></div>`;
  const b = o.querySelector("#logBody");
  log.forEach((l) => { const c = CHARS[l.who] || CHARS.n; const d = el("div", "lg" + (l.who === "n" ? " n" : ""), `<b>${c.short || c.name || ""}</b><span>${esc(l.text)}</span>`); d.style.setProperty("--c", c.color || "#9aa2c8"); b.appendChild(d); });
  if (!log.length) b.innerHTML = '<div class="empty">まだ記録はない。</div>';
  o.querySelector(".ov-x").onclick = () => { Snd.sfx("close"); o.classList.remove("on"); };
  o.classList.add("on"); b.scrollTop = b.scrollHeight;
}
$("#btnLog").onclick = openLog;
$("#btnDlgLog").addEventListener("click", (e) => { e.stopPropagation(); openLog(); });
/* 会話の途中のセーブ。いま読んでいる行から再開できる */
$("#btnDlgSave").addEventListener("click", (e) => {
  e.stopPropagation(); setSkip(false);
  if (!S.started || S.bonus) { toast("この章は記録されません", 2200); return; }
  Snd.sfx("ok"); save();
});
/* 音楽・効果音のクレジット（配布元の利用規約にもとづく表記。同じ内容を License.txt にも入れてある） */
const CREDIT_HTML = `<div class="paper credit"><div class="p-h">音楽・効果音</div>
  <p><b>音楽</b><br>なぐもりずの音楽室（南雲 莉翠）<br><small>https://nagumorizu.com/</small></p>
  <p><b>効果音</b><br>OtoLogic（CC BY 4.0）<br><small>https://otologic.jp/</small><br>On-Jin ～音人～<br><small>https://on-jin.com/</small></p>
  <p class="p-sub">楽曲の著作権は、作曲者の南雲 莉翠(nagumorizu)に帰属します。<br>音楽・効果音のファイルの二次配布、無断での利用は禁止されています。<br>くわしくは、同梱の License.txt をごらんください。</p></div>`;
function openSettings() {
  Snd.sfx("open");
  const o = $("#setOv");
  const draw = () => {
    o.innerHTML = `<div class="ov-h"><b>設定</b><span>SETTINGS</span></div><button class="ov-x">とじる</button><div id="setBody">
      <div class="row"><span>音</span><div class="seg"><button data-k="snd" data-v="1" class="${Snd.muted ? "" : "on"}">オン</button><button data-k="snd" data-v="0" class="${Snd.muted ? "on" : ""}">オフ</button></div></div>
      <div class="row"><span>文字の速さ</span><div class="seg"><button data-k="spd" data-v="44" class="${textSpeed === 44 ? "on" : ""}">ゆっくり</button><button data-k="spd" data-v="26" class="${textSpeed === 26 ? "on" : ""}">ふつう</button><button data-k="spd" data-v="10" class="${textSpeed === 10 ? "on" : ""}">はやい</button></div></div>
      <div class="row"><span>音楽・効果音</span><div class="seg"><button data-k="credit">クレジットを見る</button></div></div>
      <div class="row"><span>ここまでを記録して終わる</span><div class="seg"><button data-k="title" class="on">セーブしてタイトルへ</button></div></div>
      <div class="note">進み具合は、セリフを1つ読むごとに自動で記録されます。会話の途中でも、セリフ枠の「セーブ」で記録できます。<br>続きは、タイトルの「つづきから」で始められます。<br>会話中は Ctrl キーを押している間、早送りできます。</div></div>`;
    o.querySelector(".ov-x").onclick = () => { Snd.sfx("close"); o.classList.remove("on"); };
    o.querySelectorAll("[data-k]").forEach((b) => { b.onclick = () => {
      Snd.sfx("click");
      if (b.dataset.k === "snd") { Snd.setMuted(b.dataset.v === "0"); draw(); }
      else if (b.dataset.k === "credit") showDoc(CREDIT_HTML);
      else if (b.dataset.k === "spd") { textSpeed = +b.dataset.v; try { localStorage.setItem("zankyo_speed", textSpeed); } catch (e) { /* 無視 */ } draw(); }
      else { o.classList.remove("on"); save(); showTitle(); }
    }; });
  };
  draw(); o.classList.add("on");
}
$("#btnSet").onclick = () => { if (mode === "idle") openSettings(); };
function closeTopOverlay() {
  for (const id of ["#docOv", "#setOv", "#logOv", "#mapOv"]) { const o = $(id); if (o.classList.contains("on")) { o.click && id === "#docOv" ? o.click() : o.classList.remove("on"); return; } }
  if ($("#noteOv").classList.contains("on") && !(noteOpt && noteOpt.force)) closeNote(null);
}

/* ================================================================ タイトル・結末 */
function showTitle() {
  mode = "title"; rainStopped = false; Snd.bgm("rain");
  ["#mapOv", "#noteOv", "#logOv", "#setOv", "#ending", "#reconOv"].forEach((i) => $(i).classList.remove("on"));
  $("#stage").classList.remove("dark"); rcStop();
  $("#tEcho").hidden = !endsSeen().includes("true"); $("#titleBtns").classList.toggle("four", !$("#tEcho").hidden);
  $("#title").classList.add("on"); $("#titleBg").style.backgroundImage = `url(img/bg/title.jpg${IMG_V})`;
  $("#tCont").disabled = !loadSave();
  $("#tSound").textContent = "音：" + (Snd.muted ? "オフ" : "オン");
  $("#tVer").textContent = "Ver " + GAME_VER;
}
/* 見た結末の記録（進み具合とは別に残す） */
function endsSeen() { try { return JSON.parse(localStorage.getItem("zankyo_ends") || "[]"); } catch (e) { return []; } }
function markEnd(k) { const a = endsSeen(); if (!a.includes(k)) { a.push(k); try { localStorage.setItem("zankyo_ends", JSON.stringify(a)); } catch (e) { /* 無視 */ } } }
/* 保存したところから再開する。最後の推理の途中なら、その区切りから */
function resume() {
  S.ended = false; S.accused = null; S.uv = false; log = []; applyName(); rainStopped = false;
  Object.keys(S.flags).forEach((k) => { if (k.startsWith("acc_")) delete S.flags[k]; });
  if ((S.clock || 0) >= CLOCK_LIMIT) { S.clock = CLOCK_LIMIT - 24; S.warn = 2; }
  ["#title", "#ending"].forEach((i) => $(i).classList.remove("on"));
  const at = S.at, sc = !S.cp && at ? sceneAt(at.p) : null;
  if (S.cp) { setBg("classroom"); lifeOn = true; lifeN = 5; drawLife(); Snd.bgm("showdown"); play(SCENES[S.cp]); }
  else if (sc && at.i < sc.length) {
    // 会話の途中で記録していた：背景と音を戻して、その行から続ける
    ["#chars", "#hs", "#hsuv"].forEach((i) => { $(i).innerHTML = ""; });
    rainStopped = !!at.rs; setBg(at.bg || LOCS[S.loc].bg); $("#stage").classList.toggle("dark", !!at.dark);
    const sn = at.snd || {}; Snd.bgm(sn.m || "stop"); Snd.rain(!!sn.r);
    if (at.cast && at.cast.length) setCast(at.cast);
    play(sc, null, at.i);
  }
  else idle();
}
/* 終了：アプリ（apk）なら、アプリを閉じる。ブラウザなら窓を閉じ、閉じられなければ「閉じてください」の画面を出す。記録は1行ごとに済んでいる */
$("#tQuit").onclick = () => {
  Snd.sfx("click"); Snd.bgm("stop");
  if (window.ZankyoApp && ZankyoApp.exit) { ZankyoApp.exit(); return; }
  try { window.close(); } catch (e) { /* 無視 */ }
  setTimeout(() => { if (!window.closed) $("#quitOv").classList.add("on"); }, 300);
};
$("#quitBack").onclick = () => { $("#quitOv").classList.remove("on"); showTitle(); };
$("#tSound").onclick = () => { Snd.setMuted(!Snd.muted); $("#tSound").textContent = "音：" + (Snd.muted ? "オフ" : "オン"); Snd.sfx("click"); if (!Snd.muted) Snd.bgm("rain"); };
$("#tNew").onclick = async () => {
  goFull(); Snd.resume(); Snd.sfx("click");
  if (loadSave()) { $("#title").classList.remove("on"); const i = await choice("保存された捜査記録を消して、最初から始める？", ["最初から始める", "やめる"]); if (i !== 0) return showTitle(); }
  S = newState(); log = []; lifeOn = false; drawLife();
  $("#title").classList.remove("on");
  S.pname = await askName(); applyName();
  S.started = true;
  play(SCENES.prologue);
};
/* ---------- 主人公の名前を付ける画面 */
const cleanName = (v, d) => (String(v || "").replace(/[《》{}|<>&"'\\\s:：\/@]/g, "").slice(0, 6)) || d;
function askName() {
  return new Promise((res) => {
    const o = $("#nameOv");
    o.innerHTML = `<div class="ov-h"><b>主人公の名前</b><span>YOUR NAME</span></div><div id="nameBody">
      <p class="lead">僕は2年B組のどこにでもいる普通の高校生だ。<br>文化祭の前日、あの事件に出会うまでは。<br>――僕の名前は。（そのままでも始められます）</p>
      <div class="nrow"><label>姓<input id="nmSei" maxlength="6" value="${PNAME.sei}" autocomplete="off" spellcheck="false"></label>
        <label>名<input id="nmMei" maxlength="6" value="${PNAME.mei}" autocomplete="off" spellcheck="false"></label></div>
      <div class="nrow"><label class="wide">呼び名<input id="nmYobi" maxlength="6" value="${PNAME.yobi}" autocomplete="off" spellcheck="false"><small>幼なじみのひよりが、こう呼びます</small></label></div>
      <div class="nprev"><span id="nmP1"></span><span id="nmP2"></span></div>
      <div class="nbtns"><button class="nbtn hot" id="nmOk"><span>この名前で始める</span></button><button class="nbtn" id="nmReset"><span>もとに戻す</span></button></div></div>`;
    const get = () => ({ sei: cleanName($("#nmSei").value, PNAME.sei), mei: cleanName($("#nmMei").value, PNAME.mei), yobi: cleanName($("#nmYobi").value, PNAME.yobi) });
    const prev = () => { const p = get(); $("#nmP1").textContent = `委員長「${p.sei}くん、暗幕は窓側から張ってちょうだい」`; $("#nmP2").textContent = `ひより「${p.yobi}、そっち持って！」`; };
    o.querySelectorAll("input").forEach((i) => { i.oninput = prev; i.onblur = () => setTimeout(fit, 80); i.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") i.blur(); }; });
    $("#nmReset").onclick = () => { Snd.sfx("click"); $("#nmSei").value = PNAME.sei; $("#nmMei").value = PNAME.mei; $("#nmYobi").value = PNAME.yobi; prev(); };
    $("#nmOk").onclick = () => { Snd.sfx("ok"); const p = get(); o.classList.remove("on"); setTimeout(fit, 80); res(p); };
    prev(); o.classList.add("on");
  });
}
/* 真相を見たあとに開く短い章。進み具合の記録とは切りはなして流す */
$("#tEcho").onclick = async () => {
  goFull(); Snd.resume(); Snd.sfx("click");
  S = newState(); S.bonus = 1; log = []; lifeOn = false; drawLife(); mode = "scene";
  $("#title").classList.remove("on");
  ["#hud", "#actions", "#idleTip"].forEach((i) => $(i).classList.add("off"));
  await run(SCENES.echo);
  setSkip(false); endDialogue(); S = newState(); showTitle();
};
$("#tCont").onclick = () => {
  const s = loadSave(); if (!s) return;
  goFull(); Snd.resume(); Snd.sfx("click");
  S = Object.assign(newState(), s);
  resume();
};
function showEnding() {
  const kind = S.ended === true ? "true" : S.ended, E = ENDINGS.find((e) => e.id === kind) || ENDINGS[0];
  mode = "title"; endDialogue(); lifeOn = false; drawLife(); $("#stage").classList.remove("uvon"); S.at = null;
  $("#hud").classList.add("off"); $("#actions").classList.add("off");
  markEnd(E.id);
  const seen = endsSeen();
  const list = `<div class="ends"><small>結末 ${seen.length} / ${ENDINGS.length}</small>` + ENDINGS.map((e) => `<span class="${seen.includes(e.id) ? "got" : ""}${e.id === E.id ? " now" : ""}">${seen.includes(e.id) ? e.name : "？？？"}</span>`).join("") + "</div>";
  const o = $("#ending");
  if (E.id === "true") {
    const rank = S.mistakes === 0 && S.hints <= 3 ? "名探偵" : S.mistakes <= 2 ? "切れ者の探偵" : S.mistakes <= 6 ? "ねばり強い探偵" : "あきらめない探偵";
    o.innerHTML = `<div id="endBox"><div class="e-sub">CASE CLOSED</div><h2>事件解決</h2><div class="t-line" style="margin:14px auto;width:520px"></div>
      <div class="rank"><small>あなたの称号</small>${rank}</div>
      <table><tr><td>集めた証拠品・証言</td><td>${S.ev.filter((i) => !EVID[i].tool).length + S.tes.length} 件</td></tr><tr><td>最後の推理でのまちがい</td><td>${S.mistakes} 回</td></tr><tr><td>相棒に相談した回数</td><td>${S.hints} 回</td></tr></table>
      ${list}<p>『十七時の残響』　おわり<br>遊んでくれて、ありがとうございました。</p><div class="e-btns"><button class="nbtn" data-a="title"><span>タイトルへ</span></button></div></div>`;
    Snd.bgm("clear");
  } else {
    // 真相以外の結末：進み具合は残し、直前からやり直せるようにしておく
    S.ended = false; S.accused = null;
    Object.keys(S.flags).forEach((k) => { if (k.startsWith("acc_")) delete S.flags[k]; });
    if (E.id === "timeout") { S.clock = CLOCK_LIMIT - 24; S.warn = 2; }
    save();
    o.innerHTML = `<div id="endBox" class="bad"><div class="e-sub">${E.sub}</div><h2>${E.name}</h2><div class="t-line" style="margin:14px auto;width:520px"></div>
      <p class="e-note">${E.note}</p><p class="e-tip"><b>手がかり</b>${kwHtml(E.tip)}</p>${list}
      <div class="e-btns"><button class="nbtn hot" data-a="retry"><span>${E.id === "timeout" ? "時間を巻き戻して、やり直す" : "直前の場面から、やり直す"}</span></button><button class="nbtn" data-a="title"><span>タイトルへ</span></button></div></div>`;
    Snd.bgm("sad");
  }
  o.querySelector('[data-a="title"]').onclick = () => { if (E.id === "true") { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 無視 */ } } o.classList.remove("on"); showTitle(); };
  const r = o.querySelector('[data-a="retry"]'); if (r) r.onclick = () => { Snd.sfx("click"); resume(); };
  o.classList.add("on");
}

/* ================================================================ 起動 */
(function boot() {
  fit();
  try { const sp = +localStorage.getItem("zankyo_speed"); if (sp) textSpeed = sp; } catch (e) { /* 無視 */ }
  // 絵を先に読んでおく
  Object.values(LOCS).forEach((L) => { new Image().src = `img/bg/${L.bg}.jpg${IMG_V}`; });
  new Image().src = `img/bg/ev_fallen.jpg${IMG_V}`;   // 冒頭の場面の絵
  Object.keys(FACE).forEach((id) => { new Image().src = spriteSrc(id); });
  S = newState();
  showTitle();
  // 開発用：?debug で window.G から中をのぞける
  if (new URLSearchParams(location.search).has("debug")) window.G = { get S() { return S; }, set S(v) { S = v; }, idle, play, has, cond, hintText, run, get mode() { return mode; }, setSkip, tick, set turbo(v) { turbo = v; } };
})();
