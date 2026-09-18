/* Elif & Yusuf Çağrı — arka plan müziği
   assets/audio/muzik.mp3 varsa o çalar; yoksa tarayıcıda üretilen özgün bir piyano valsi çalar. */
(function () {
  "use strict";
  var FILE = "assets/audio/muzik.mp3";
  var btn = document.getElementById("music");
  if (!btn) return;
  var label = btn.querySelector(".mu-label");
  var state = { playing: false, mode: null, audio: null, ctx: null, master: null, timer: null, next: 0, step: 0, wanted: false };

  function setUI(noSave) {
    btn.classList.toggle("on", state.playing);
    if (state.playing) btn.classList.remove("hint");
    btn.setAttribute("aria-pressed", state.playing ? "true" : "false");
    label.textContent = state.playing ? "Müziği durdur" : "Müziği çal";
    if (!noSave) try { sessionStorage.setItem("ey_music", state.playing ? "1" : "0"); } catch (e) {}
  }

  /* ---------- dosya ---------- */
  var fileCheck = (location.protocol === "file:" ? Promise.resolve(false) :
    fetch(FILE, { method: "HEAD", cache: "no-store" }).then(function (r) {
    var t = r.headers.get("content-type") || "";
    return r.ok && /audio|mpeg|octet/.test(t);
    }).catch(function () { return false; }));

  function playFile() {
    if (!state.audio) {
      state.audio = new Audio(FILE);
      state.audio.loop = true;
      state.audio.volume = 0;
    }
    var a = state.audio;
    return a.play().then(function () { fadeEl(a, .55, 1800); });
  }
  function fadeEl(a, to, ms, done) {
    var from = a.volume, t0 = performance.now();
    (function step(t) {
      var k = Math.min(1, (t - t0) / ms);
      a.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    })(t0);
  }

  /* ---------- özgün vals (3/4, 72 vuruş) ---------- */
  var N = { A2: 45, B2: 47, C3: 48, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57, B3: 59, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81 };
  // her ölçü: [bas, akor, ezgi (nota, vuruş)...]
  var BARS = [
    ["C3", ["E4", "G4", "C5"], [["E5", 2], ["G5", 1]]],
    ["B2", ["D4", "G4", "B4"], [["D5", 2], ["B4", 1]]],
    ["A2", ["E4", "A4", "C5"], [["C5", 2], ["E5", 1]]],
    ["F3", ["A3", "C4", "F4"], [["A4", 3]]],
    ["C3", ["E4", "G4", "C5"], [["G4", 1], ["C5", 1], ["E5", 1]]],
    ["F3", ["A3", "C4", "F4"], [["F5", 2], ["E5", 1]]],
    ["G3", ["B3", "D4", "G4"], [["D5", 1], ["E5", 1], ["F5", 1]]],
    ["G3", ["B3", "D4", "F4"], [["D5", 3]]],
    ["C3", ["E4", "G4", "C5"], [["E5", 2], ["G5", 1]]],
    ["E3", ["G4", "B4", "E5"], [["G5", 1], ["F5", 1], ["E5", 1]]],
    ["A2", ["E4", "A4", "C5"], [["E5", 2], ["C5", 1]]],
    ["F3", ["A3", "C4", "F4"], [["A5", 2], ["G5", 1]]],
    ["G3", ["C4", "E4", "G4"], [["G5", 1], ["E5", 1], ["C5", 1]]],
    ["F3", ["A3", "C4", "F4"], [["D5", 1], ["C5", 1], ["A4", 1]]],
    ["G3", ["B3", "D4", "F4"], [["B4", 2], ["D5", 1]]],
    ["C3", ["E4", "G4", "C5"], [["C5", 3]]]
  ];
  var BEAT = 60 / 72;

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function makeReverb(ctx) {
    var len = ctx.sampleRate * 3.2, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    var cv = ctx.createConvolver(); cv.buffer = buf; return cv;
  }

  function note(t, midi, vel, dur, bright) {
    var ctx = state.ctx, f0 = hz(midi);
    var out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vel, t + 0.008);
    out.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.35);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(9000, f0 * (bright ? 9 : 6)), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, f0 * 2), t + dur);
    out.connect(lp); lp.connect(state.bus);
    [[1, 1], [2, .42], [3, .16], [4, .07], [5.02, .03]].forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f0 * p[0];
      o.detune.value = (Math.random() - .5) * 4;
      g.gain.value = p[1];
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + .05);
    });
  }

  function bell(t, midi, vel) {
    var ctx = state.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o2.type = "sine";
    o.frequency.value = hz(midi); o2.frequency.value = hz(midi) * 2.76;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + .004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    var g2 = ctx.createGain(); g2.gain.value = .25;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(state.bus);
    o.start(t); o2.start(t); o.stop(t + 3.6); o2.stop(t + 3.6);
  }

  function scheduleBar(i, t) {
    var bar = BARS[i % BARS.length], round = Math.floor(i / BARS.length);
    var h = function () { return (Math.random() - .5) * 0.018; };
    note(t + h(), N[bar[0]], .22, BEAT * 3.2, false);
    note(t + h(), N[bar[0]] + 12, .06, BEAT * 2.5, false);
    [1, 2].forEach(function (b) {
      bar[1].forEach(function (n, k) { note(t + b * BEAT + k * .012 + h(), N[n], .045, BEAT * 1.6, false); });
    });
    var pos = 0;
    bar[2].forEach(function (m) {
      var midi = N[m[0]] + (round % 2 === 1 && i % BARS.length >= 8 ? 12 : 0);
      note(t + pos * BEAT + h(), midi, .16, BEAT * (m[1] + 1.4), true);
      pos += m[1];
    });
    if (i % 4 === 3) bell(t + 2 * BEAT, N[bar[1][2]] + 24, .03);
  }

  function scheduler() {
    var ctx = state.ctx;
    while (state.next < ctx.currentTime + 1.2) {
      scheduleBar(state.step, state.next);
      state.next += BEAT * 3;
      state.step++;
    }
  }

  function playSynth() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return Promise.reject(new Error("no audio"));
    if (!state.ctx) {
      var ctx = state.ctx = new AC();
      state.master = ctx.createGain(); state.master.gain.value = 0.0001;
      var comp = ctx.createDynamicsCompressor();
      state.bus = ctx.createGain(); state.bus.gain.value = .9;
      var rev = makeReverb(ctx), wet = ctx.createGain(); wet.gain.value = .32;
      state.bus.connect(comp); state.bus.connect(rev); rev.connect(wet); wet.connect(comp);
      comp.connect(state.master); state.master.connect(ctx.destination);
      state.next = ctx.currentTime + .15;
    }
    return state.ctx.resume().then(function () {
      var ctx = state.ctx, g = state.master.gain;
      if (state.next < ctx.currentTime) state.next = ctx.currentTime + .1;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(Math.max(g.value, .0001), ctx.currentTime);
      g.exponentialRampToValueAtTime(.7, ctx.currentTime + 2);
      clearInterval(state.timer);
      state.timer = setInterval(scheduler, 200);
      scheduler();
    });
  }

  function play() {
    state.wanted = true;
    return fileCheck.then(function (hasFile) {
      state.mode = hasFile ? "file" : "synth";
      return hasFile ? playFile().catch(function () { state.mode = "synth"; return playSynth(); }) : playSynth();
    }).then(function () { state.playing = true; setUI(); })
      .catch(function () { state.playing = false; setUI(); });
  }

  function pause(keepWanted) {
    if (!keepWanted) state.wanted = false;
    state.playing = false; setUI();
    if (state.mode === "file" && state.audio) {
      var a = state.audio;
      fadeEl(a, 0, 600, function () { a.pause(); });
    } else if (state.ctx) {
      var ctx = state.ctx, g = state.master.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(Math.max(g.value, .0001), ctx.currentTime);
      g.exponentialRampToValueAtTime(.0001, ctx.currentTime + .6);
      clearInterval(state.timer);
      setTimeout(function () { if (!state.playing) ctx.suspend(); }, 700);
    }
  }

  btn.addEventListener("click", function () { if (state.playing) pause(); else play(); });

  // Davetiyeyi açınca başlasın
  var opener = document.getElementById("introOpen");
  if (opener) opener.addEventListener("click", function () { if (!state.playing) play(); });

  // Daha önce açıksa ilk dokunuşta devam etsin (tarayıcılar otomatik başlatmaya izin vermez)
  var was = null; try { was = sessionStorage.getItem("ey_music"); } catch (e) {}
  if (was === "1") {
    var resume = function (e) {
      if (btn.contains(e.target) || (opener && opener.contains(e.target))) return;
      document.removeEventListener("pointerdown", resume, true);
      if (!state.playing) play();
    };
    document.addEventListener("pointerdown", resume, true);
  }
  if (was !== "1") btn.classList.add("hint");
  setTimeout(function () { btn.classList.add("quiet"); }, 6000);
  btn.addEventListener("click", function () { btn.classList.remove("hint"); });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && state.playing) pause(true);
    else if (!document.hidden && state.wanted && !state.playing) play();
  });
  setUI(true);
})();
