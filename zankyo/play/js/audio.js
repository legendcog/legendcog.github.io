/* 音：曲（img/bgm）・効果音の一部と雨（img/sfx）は用意された mp3 を鳴らす。それ以外と、読めなかったときは WebAudio でその場で作る。
   localhost で開いたときは既定で無音（?sound=1 で鳴らす）。?silent でどこでも無音。 */
"use strict";

const Snd = (() => {
  const qs = new URLSearchParams(location.search);
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const dry = qs.get("sound") === "test";      // 確認用：音を作る処理は全部通すが、出口の音量は 0 のまま
  let muted = qs.has("silent") || (isLocal && !qs.has("sound"));
  if (!muted) { try { if (localStorage.getItem("zankyo_mute") === "1") muted = true; } catch (e) { /* 保存できない環境でも動かす */ } }
  let ctx = null, master = null, musicBus = null, rainBus = null, sfxBus = null;
  let musicTimer = null, musicMode = "", rainOn = false, rainNode = null, step = 0;
  let sfxOut = null;      // 合成の効果音を鳴らすあいだだけ、その音の倍率をかけた出口を入れる

  function init() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = muted || dry ? 0 : 0.9; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
    rainBus = ctx.createGain(); rainBus.gain.value = 0; rainBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    loadWaltz(); loadSfx();
    return true;
  }
  function resume() { if (init() && ctx.state === "suspended") ctx.resume(); }
  /* アプリが裏に回ったら音を止め、戻ったら続ける（Android の入れ物 MainActivity が呼ぶ） */
  function hold(on) { if (!ctx) return; if (on) ctx.suspend(); else if (ctx.state === "suspended") ctx.resume(); }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem("zankyo_mute", m ? "1" : "0"); } catch (e) { /* 無視 */ }
    if (init()) master.gain.setTargetAtTime(m || dry ? 0 : 0.9, ctx.currentTime, 0.05);
    if (!m) resume();
  }

  function noiseBuf(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  /* ひとつの音。type: 波形、a/d: 立ち上がり/減衰 */
  function tone(freq, t, dur, o = {}) {
    const bus = o.bus || sfxOut || sfxBus, g = ctx.createGain(), osc = ctx.createOscillator();
    osc.type = o.type || "sine"; osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    const v = o.vol === undefined ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.a || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(bus); osc.start(t); osc.stop(t + dur + 0.05);
  }
  /* ピアノ風：基音＋倍音を重ねて長く減衰させる */
  function pianoNote(freq, t, dur = 1.6, vol = 0.22, bus) {
    tone(freq, t, dur, { type: "triangle", vol, bus });
    tone(freq * 2, t, dur * 0.6, { type: "sine", vol: vol * 0.35, bus });
    tone(freq * 3, t, dur * 0.3, { type: "sine", vol: vol * 0.12, bus });
  }
  function noise(t, dur, o = {}) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(Math.max(0.1, dur));
    const f = ctx.createBiquadFilter(); f.type = o.ftype || "lowpass"; f.frequency.setValueAtTime(o.freq || 800, t);
    if (o.fslide) f.frequency.exponentialRampToValueAtTime(o.fslide, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(o.vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxOut || sfxBus); src.start(t); src.stop(t + dur);
  }

  const N = { C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, B3: 246.94,
    C4: 261.63, "C#4": 277.18, D4: 293.66, "D#4": 311.13, E4: 329.63, F4: 349.23, "F#4": 369.99, G4: 392, "G#4": 415.3, A4: 440, "A#4": 466.16, B4: 493.88,
    "G#3": 207.65, B2: 123.47, "D#5": 622.25, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, A2: 110, E2: 82.41, F2: 87.31, G2: 98, C2: 65.41, D2: 73.42, A1: 55 };

  const SFX = {
    blip(t) { tone(920, t, 0.03, { type: "square", vol: 0.025 }); },
    click(t) { tone(660, t, 0.05, { type: "triangle", vol: 0.12 }); tone(990, t + 0.03, 0.06, { type: "triangle", vol: 0.08 }); },
    open(t) { tone(440, t, 0.07, { type: "triangle", vol: 0.1 }); tone(660, t + 0.05, 0.1, { type: "triangle", vol: 0.1 }); },
    close(t) { tone(520, t, 0.07, { type: "triangle", vol: 0.08, slide: 300 }); },
    hover(t) { tone(1200, t, 0.02, { type: "sine", vol: 0.03 }); },
    kw(t) { [1318, 1760, 2093].forEach((f, i) => tone(f, t + i * 0.05, 0.25, { type: "sine", vol: 0.07 })); },
    get(t) { noise(t, 0.25, { freq: 3000, fslide: 300, vol: 0.2 }); [523, 659, 784, 1046, 1318].forEach((f, i) => pianoNote(f, t + 0.08 + i * 0.07, 0.9, 0.16)); },
    tes(t) { noise(t, 0.18, { ftype: "highpass", freq: 2000, vol: 0.12 }); pianoNote(784, t + 0.05, 0.6, 0.15); pianoNote(1174, t + 0.16, 0.9, 0.15); },
    ded(t) { noise(t, 0.5, { freq: 200, fslide: 6000, vol: 0.25 }); [220, 329.6, 440, 659.2, 880].forEach((f) => pianoNote(f, t + 0.45, 2.2, 0.14)); tone(55, t + 0.45, 1.2, { type: "sine", vol: 0.4 }); },
    thunder(t) { noise(t, 0.12, { freq: 6000, vol: 0.5 }); noise(t + 0.08, 2.6, { freq: 220, fslide: 60, vol: 0.9 }); },
    wrong(t) { tone(160, t, 0.3, { type: "sawtooth", vol: 0.16, slide: 90 }); },
    ok(t) { pianoNote(880, t, 0.5, 0.16); pianoNote(1318, t + 0.09, 0.8, 0.16); },
    cut(t) { noise(t, 0.3, { freq: 5000, fslide: 200, vol: 0.5 }); tone(80, t, 0.6, { type: "sine", vol: 0.6, slide: 40 }); },
    scratch(t) { for (let i = 0; i < 5; i++) noise(t + i * 0.16, 0.13, { ftype: "bandpass", freq: 2400, vol: 0.12 }); },
    chapter(t) { tone(110, t, 2.4, { type: "sine", vol: 0.3 }); pianoNote(440, t + 0.2, 2.4, 0.14); pianoNote(659.2, t + 0.5, 2.4, 0.12); },
    chime(t) { [659.25, 523.25, 587.33, 392].forEach((f, i) => { tone(f, t + i * 0.62, 1.9, { type: "sine", vol: 0.13 }); tone(f * 2, t + i * 0.62, 1.1, { type: "sine", vol: 0.03 }); }); },
    thud(t) { noise(t, 0.09, { freq: 300, vol: 0.5 }); },
    uv(t) { tone(200, t, 0.5, { type: "sawtooth", vol: 0.05, slide: 900 }); },
    step(t) { noise(t, 0.08, { freq: 500, vol: 0.2 }); noise(t + 0.18, 0.08, { freq: 420, vol: 0.16 }); },
    life(t) { tone(300, t, 0.25, { type: "square", vol: 0.1, slide: 120 }); noise(t, 0.2, { freq: 900, vol: 0.2 }); },
  };
  /* 用意された効果音（img/sfx/*.mp3）。名前 → そろえるための音量。読めたらこちらを鳴らし、読めなければ上の合成の音で代える。
     雨（rain）は鳴らしっぱなしの音なので、下の rain() が使う */
  /* 音量は、tools/loud.js で測ってそろえてある（ゲームの中で鳴る大きさで、知らせの音は -25、落雷 -22、チャイム -27、足音 -30 LUFS） */
  const SFX_FILE = { thunder: 1, chime: 0.48, ded: 0.65, get: 0.56, tes: 0.68, kw: 0.93, chapter: 0.72, step: 1.9, wrong: 1.76, life: 1.34 };
  /* 合成の音の大きさをそろえる倍率（知らせの音は -25、操作の音は -36、文字送りは -50 LUFS あたり） */
  const SFX_SYNTH = { ok: 1.53, cut: 0.77, click: 2.8, open: 2.3, close: 4.5, hover: 4.7, blip: 2.4, scratch: 3.7, thud: 14, uv: 3.7 };
  function synth(name, t) {
    const f = SFX[name]; if (!f) return;
    const out = ctx.createGain(); out.gain.value = SFX_SYNTH[name] || 1; out.connect(sfxBus);
    sfxOut = out; try { f(t); } finally { sfxOut = null; }
  }
  /* 長い音を短く切る：名前 → [小さくしはじめる秒, 消えるまでの秒]。足音は4歩ぶん、チャイムは前半（2節ぶん）まで */
  const SFX_CUT = { step: [2.15, 0.2], chime: [10.5, 0.9] };
  const SFX_LONG = 4;                 // これより長い音は、重ねずに鳴らし直す（前のを小さくして止める）
  const sfxBuf = {}, sfxLive = {};
  function loadFile(path) {
    return fetch(path + (typeof IMG_V === "string" ? IMG_V : ""))
      .then((r) => { if (!r.ok) throw new Error("no file"); return r.arrayBuffer(); })
      .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)));
  }
  let sfxAsked = false;
  function loadSfx() {
    if (sfxAsked) return; sfxAsked = true;
    Object.keys(SFX_FILE).forEach((n) => { loadFile("img/sfx/" + n + ".mp3").then((b) => { sfxBuf[n] = b; }).catch(() => { /* 読めなければ合成の音のまま */ }); });
    loadFile("img/sfx/rain.mp3").then((b) => { rainBuf = b; if (rainNode) rainFileStart(); }).catch(() => { /* 合成の雨のまま */ });
  }
  function sfx(name) {
    if (muted || !init()) return;
    resume();
    const buf = sfxBuf[name], t = ctx.currentTime + 0.005;
    if (!buf) { synth(name, t); return; }
    const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = buf; g.gain.value = SFX_FILE[name];
    src.connect(g); g.connect(sfxBus); src.start(t);
    const cut = SFX_CUT[name];
    if (cut) { g.gain.setValueAtTime(SFX_FILE[name], t + cut[0]); g.gain.linearRampToValueAtTime(0.0001, t + cut[0] + cut[1]); src.stop(t + cut[0] + cut[1] + 0.05); }
    if (buf.duration > SFX_LONG) {
      const old = sfxLive[name];
      if (old) { try { old[1].gain.setTargetAtTime(0.0001, t, 0.08); old[0].stop(t + 0.5); } catch (e) { /* もう止まっている */ } }
      sfxLive[name] = [src, g];
    }
  }

  /* 『夕凪のワルツ』：ラ（A4）が何度も出てくる短い主題 */
  const WALTZ = [["A4", 1], ["C5", 1], ["E5", 1], ["E5", 2], ["D5", 1], ["C5", 1], ["B4", 1], ["A4", 1], ["A4", 3],
    ["F4", 1], ["A4", 1], ["C5", 1], ["C5", 2], ["B4", 1], ["A4", 1], ["G#4", 1], ["A4", 1], ["A4", 3]];
  const WALTZ_BASS = ["A2", "A2", "F2", "A2", "F2", "F2", "E2", "A2"];
  /* 録音された演奏（js/waltz.js）。読めたらこちらを鳴らし、読めなければ下の合成の音で代える */
  let waltzBuf = null, waltzSrc = null;
  function loadWaltz() {
    if (waltzBuf || typeof WALTZ_B64 === "undefined") return;
    try {
      const bin = atob(WALTZ_B64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      ctx.decodeAudioData(u.buffer, (b) => { waltzBuf = b; }, () => { /* 読めなければ合成の音のまま */ });
    } catch (e) { /* 無視 */ }
  }
  function melody() {
    if (muted || !init()) return;
    resume();
    if (waltzBuf) {
      if (waltzSrc) { try { waltzSrc.stop(); } catch (e) { /* もう止まっている */ } }
      // 終わりの WALTZ_FADE 秒は、音をなめらかに小さくして消す（ぷつっと切れないように）
      const t0 = ctx.currentTime + 0.05, end = t0 + waltzBuf.duration, fade = Math.min(WALTZ_FADE, waltzBuf.duration * 0.5);
      const g = ctx.createGain(); g.connect(master);
      g.gain.setValueAtTime(WALTZ_VOL, t0); g.gain.setValueAtTime(WALTZ_VOL, end - fade); g.gain.linearRampToValueAtTime(0.0001, end);
      waltzSrc = ctx.createBufferSource(); waltzSrc.buffer = waltzBuf; waltzSrc.connect(g); waltzSrc.start(t0);
      return;
    }
    const beat = 0.34; let t = ctx.currentTime + 0.1, b = 0;
    WALTZ.forEach(([n, len]) => { pianoNote(N[n], t + b * beat, len * beat + 1.2, 0.2); b += len; });
    WALTZ_BASS.forEach((n, i) => {
      const bt = t + i * 3 * beat;
      pianoNote(N[n], bt, 1.6, 0.13);
      pianoNote(N[n] * 2, bt + beat, 0.5, 0.05); pianoNote(N[n] * 3, bt + beat * 2, 0.5, 0.05);
    });
  }
  const WALTZ_VOL = 0.68, WALTZ_FADE = 1.6;
  function key(name, dead) {
    if (muted || !init()) return;
    resume();
    if (dead) synth("thud", ctx.currentTime); else pianoNote(N[name], ctx.currentTime, 1.6, 0.25);
  }

  /* 雨（鳴らしっぱなしの環境音） */
  function rain(on) {
    if (!init()) return;
    if (on && !rainNode) {
      if (rainBuf) { rainNode = {}; rainFileStart(); }
      else {
        rainNode = ctx.createBufferSource(); rainNode.buffer = noiseBuf(3); rainNode.loop = true;
        const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 0.4;
        rainNode.connect(f); f.connect(rainBus); rainNode.start();
      }
    }
    rainOn = on;
    rainBus.gain.setTargetAtTime(on ? RAIN_VOL * rainPlace : 0, ctx.currentTime, 0.8);
  }
  /* 用意された雨の音（img/sfx/rain.mp3）をくり返す。切れ目が目立たないよう、終わりの RAIN_XF 秒を次の頭と重ねる。
     合成の雨が鳴っていたら、そちらは止める。大きさは rainBus（場所ごとの大きさ）にまかせ、ここでは録音と合成の差だけをそろえる */
  let rainBuf = null, rainTimer = null;
  const RAIN_FILE_GAIN = 5.2, RAIN_XF = 1.5;
  function rainFileStart() {
    if (rainTimer || !rainBuf) return;
    if (rainNode && rainNode.stop) { try { rainNode.stop(); } catch (e) { /* もう止まっている */ } rainNode = {}; }
    const inp = ctx.createGain(); inp.gain.value = RAIN_FILE_GAIN; inp.connect(rainBus);
    const dur = rainBuf.duration, xf = Math.min(RAIN_XF, dur / 4);
    const spawn = (t0) => {
      const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = rainBuf;
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(1, t0 + xf);
      g.gain.setValueAtTime(1, t0 + dur - xf); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      src.connect(g); g.connect(inp); src.start(t0);
    };
    let next = ctx.currentTime + 0.05; spawn(next); next += dur - xf;
    rainTimer = setInterval(() => { if (ctx.state === "running" && ctx.currentTime > next - 1) { spawn(next); next += dur - xf; } }, 250);
  }
  /* 雨の大きさ。外（渡り廊下・体育館裏）はそのまま、校舎の中は窓ごしなので半分以下 */
  const RAIN_VOL = 0.05;
  let rainPlace = 0.7;
  function rainAt(outside) {
    rainPlace = outside ? 1 : 0.4;
    if (ctx && rainOn) rainBus.gain.setTargetAtTime(RAIN_VOL * rainPlace, ctx.currentTime, 0.6);
  }

  /* 音楽：16分割の型を回す */
  /* 考えている雰囲気の曲：時計のように刻む短い音＋「問いかけ」で終わる上がる音型。
     oct=高さ、vol=全体の大きさ、pulse=低い脈、tick=秒針 */
  const TH_CH = [["A3", "C4", "E4", "A4"], ["A3", "C4", "E4", "B4"], ["F3", "A3", "C4", "F4"], ["E3", "G#3", "B3", "E4"]];
  const TH_ASK = [null, ["C5", "D5", "E5"], null, ["B4", "D5", "F5"]];
  const TH_PAT = [0, 2, 1, 2, 0, 2, 1, 3];
  function thinkTune(o) {
    return (t, s, d) => {
      const bar = Math.floor(s / 16) % 4, i = s % 16, ch = TH_CH[bar], k = o.oct || 1, v = o.vol || 1;
      if (i === 0) tone(N[ch[0]] * k / 2, t, d * 16, { type: "sine", vol: 0.085 * v, a: 0.5, bus: musicBus });
      if (i % 2 === 0) {
        const f = N[ch[TH_PAT[i / 2]]] * k;
        tone(f, t, 0.34, { type: "triangle", vol: 0.05 * v, bus: musicBus });
        tone(f * 2, t, 0.2, { type: "sine", vol: 0.014 * v, bus: musicBus });
      }
      const ask = TH_ASK[bar];
      if (ask && (i === 8 || i === 11 || i === 14)) pianoNote(N[ask[(i - 8) / 3]] * k, t, 2.4, 0.055 * v, musicBus);
      if (o.tick && i % 4 === 0) tone(2300, t, 0.02, { type: "sine", vol: 0.012, bus: musicBus });
      if (o.pulse && i % 8 === 0) tone(58, t, 0.24, { type: "sine", vol: o.pulse, slide: 38, bus: musicBus });
      if (o.pulse && o.beat2 && i % 8 === 2) tone(54, t, 0.2, { type: "sine", vol: o.pulse * 0.6, slide: 36, bus: musicBus });
    };
  }
  /* 探索の曲：低い持続音の上で、遠い鐘のようなピアノがまばらに鳴る。レ♯（増4度）で落ち着かない色をつける */
  const MY_DRONE = [["A2", "E3"], ["F2", "C3"], ["D3", "A3"], ["E2", "B2"]];
  const MY_BELL = [{ 0: "E5", 6: "D#5", 10: "E5" }, { 2: "C5", 8: "B4", 12: "A4" }, { 0: "F5", 6: "E5", 12: "D5" }, { 4: "G#4", 10: "B4" }];
  const MUSIC = {
    explore: { bpm: 50, f(t, s, d) {
      const bar = Math.floor(s / 16) % 4, i = s % 16;
      if (i === 0) MY_DRONE[bar].forEach((n) => tone(N[n], t, d * 16 + 1.2, { type: "sine", vol: 0.05, a: 1.6, bus: musicBus }));
      const n = MY_BELL[bar][i];
      if (n && Math.random() < 0.8) {
        pianoNote(N[n], t, 3.2, 0.05, musicBus);
        pianoNote(N[n], t + d * 3, 2.4, 0.02, musicBus);    // こだま
        pianoNote(N[n], t + d * 6, 2, 0.009, musicBus);
      }
    } },
    think: { bpm: 66, f: thinkTune({ tick: 1 }) },                                   // 推理の画面
    tense: { bpm: 52, f: thinkTune({ oct: 0.5, vol: 1.25, pulse: 0.2, beat2: 1 }) },   // 重い場面：低く、ゆっくり
    showdown: { bpm: 84, f: thinkTune({ tick: 1, pulse: 0.2 }) },                     // 対決：同じ型を前のめりに
    sad: { bpm: 54, f(t, s, d) {
      const prog = [["A2", "E3", "A3", "C4", "E4"], ["F2", "C3", "F3", "A3", "C4"], ["C3", "G3", "C4", "E4", "G4"], ["E2", "B3", "E3", "G#4", "B4"]];
      const ch = prog[Math.floor(s / 16) % 4], i = s % 16;
      if (i % 3 === 0 && i < 15) pianoNote(N[ch[(i / 3) % 5]], t, 2.6, 0.1, musicBus);
    } },
    clear: { bpm: 60, f(t, s, d) {
      const prog = [["C3", "G3", "E4"], ["A2", "E3", "C4"], ["F2", "C3", "A3"], ["G2", "D3", "B3"]];
      if (s % 16 === 0) prog[Math.floor(s / 16) % 4].forEach((n) => tone(N[n], t, d * 16, { type: "sine", vol: 0.07, a: 1, bus: musicBus }));
    } },
  };
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } fileStop(); musicMode = ""; }

  /* 用意された曲（img/bgm/*.mp3）。場面の名前 → ファイル名と、そろえるための音量。
     読めたらこちらを鳴らし、読めなければ上の合成の曲で代える。
     曲はくり返す。切れ目が目立たないよう、終わりの BGM_XF 秒を次の頭と重ねて、なめらかにつなぐ */
  const BGM_FILE = { explore: ["explore", 0.95], think: ["think", 1.03], tense: ["tense", 1.2], showdown: ["showdown", 0.76], sad: ["sad", 0.68], clear: ["daily", 1.16] };   // 6曲とも -37 LUFS にそろえてある
  const BGM_VOL = 0.2, BGM_XF = 2.0, BGM_KEEP = 3;      // 全体の大きさ（小さめ）／重ねる秒数／読んだ曲を覚えておく数
  const bgmBuf = new Map(), bgmBad = {};
  let fileBus = null, fileTok = 0, fileTimer = null, fileNodes = [];
  function bgmLoad(mode) {
    if (bgmBuf.has(mode)) { const b = bgmBuf.get(mode); bgmBuf.delete(mode); bgmBuf.set(mode, b); return Promise.resolve(b); }
    return fetch("img/bgm/" + BGM_FILE[mode][0] + ".mp3" + (typeof IMG_V === "string" ? IMG_V : ""))
      .then((r) => { if (!r.ok) throw new Error("no file"); return r.arrayBuffer(); })
      .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then((b) => { bgmBuf.set(mode, b); while (bgmBuf.size > BGM_KEEP) bgmBuf.delete(bgmBuf.keys().next().value); return b; });
  }
  function fileStop() {
    fileTok++;
    if (fileTimer) { clearInterval(fileTimer); fileTimer = null; }
    const t = ctx ? ctx.currentTime : 0;
    fileNodes.forEach(([src, g]) => { try { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.15); src.stop(t + 0.8); } catch (e) { /* もう止まっている */ } });
    fileNodes = [];
  }
  function filePlay(mode) {
    const tok = ++fileTok;
    bgmLoad(mode).then((buf) => {
      if (tok !== fileTok || musicMode !== mode) return;
      if (!fileBus) { fileBus = ctx.createGain(); fileBus.gain.value = BGM_VOL; fileBus.connect(master); }
      const vol = BGM_FILE[mode][1], dur = buf.duration, xf = Math.min(BGM_XF, dur / 4);
      const spawn = (t0, first) => {
        const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = buf;
        g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + (first ? 1.2 : xf));
        g.gain.setValueAtTime(vol, t0 + dur - xf); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
        src.connect(g); g.connect(fileBus); src.start(t0);
        fileNodes.push([src, g]); if (fileNodes.length > 3) fileNodes.shift();
      };
      let next = ctx.currentTime + 0.1; spawn(next, true); next += dur - xf;
      fileTimer = setInterval(() => { if (ctx.state === "running" && ctx.currentTime > next - 1) { spawn(next, false); next += dur - xf; } }, 250);
    }).catch(() => { bgmBad[mode] = 1; if (tok === fileTok && musicMode === mode) synthPlay(mode); });
  }
  let baseMode = "", thinking = false;   // baseMode＝場面の曲。推理の画面を開いているあいだだけ「think」を上にかぶせる
  function bgm(mode) {
    if (!init()) return;
    if (mode === "rain") { baseMode = ""; stopMusic(); rain(true); return; }
    if (mode === "stop") { baseMode = ""; stopMusic(); return; }
    if (mode === "rainoff") { rain(false); return; }   // 雨が上がる（音楽はそのまま）
    let keepRain = false;
    if (mode === "calm") { mode = "clear"; keepRain = true; }   // おだやかな曲のまま、雨は降らせておく（日常の場面）
    if (mode === "clear" && !keepRain) rain(false); else if (mode !== "sad") rain(true);
    baseMode = mode;
    if (thinking && mode === "explore") mode = "think";
    startMusic(mode);
  }
  function think(on) {
    if (thinking === on) return; thinking = on;
    if (!ctx || baseMode !== "explore") return;
    startMusic(on ? "think" : "explore");
  }
  function startMusic(mode) {
    if (mode === musicMode) return;
    stopMusic();
    if (!MUSIC[mode]) return;
    musicMode = mode;
    if (BGM_FILE[mode] && !bgmBad[mode]) filePlay(mode); else synthPlay(mode);
  }
  function synthPlay(mode) {
    const m = MUSIC[mode]; step = 0;
    if (musicTimer) clearInterval(musicTimer);
    const d = 60 / m.bpm / 4;
    let next = ctx.currentTime + 0.1;
    musicTimer = setInterval(() => {
      if (ctx.state !== "running") { next = ctx.currentTime + 0.1; return; }
      while (next < ctx.currentTime + 0.25) { if (!muted) m.f(next, step, d); step++; next += d; }
    }, 80);
  }
  return { sfx, melody, key, bgm, think, get mode() { return musicMode; }, get state() { return { m: baseMode, r: rainOn }; }, get waltzReady() { return !!waltzBuf; }, get bgmInfo() { return { file: !!fileTimer, loaded: [...bgmBuf.keys()], bad: Object.keys(bgmBad), nodes: fileNodes.length }; }, get sfxInfo() { return { loaded: Object.keys(sfxBuf), rainFile: !!rainTimer }; }, get waltzSec() { return waltzBuf ? waltzBuf.duration : 0; }, rain, rainAt, setMuted, resume, hold, names: () => Object.keys(SFX), get muted() { return muted; }, get isLocal() { return isLocal; } };
})();
