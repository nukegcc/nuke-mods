// «تحدّى ربعك بردة الفعل» (owner's pick, 2026-10-12: «دائرة وحدة» and «خمس بلوكات», the look chosen in the phone's settings).
// Shared by remote.html (the player) and challenge.html (a friend who got the link, in any browser, no app).
//   NKRx.play(box, mode "circle" | "blocks", onDone(ms))   draws the game inside `box`; ms = the reaction (blocks: the average of 5)
//   NKRx.rank(ms, mode) → a word for the result (each look on its own scale)
"use strict";
(function () {
  const now = () => performance.now();
  // the words for a result, each look by its own scale: the circle is a pure reaction (a fast person ~200 ms); the five blocks
  // add the finger's travel to a random spot (a fast person ~400 ms) — the circle's scale said «تقدر أحسن» to everyone there
  const SCALE = { circle: [180, 230, 290], blocks: [360, 440, 540] };
  const rank = (ms, mode = "circle") => {
    const [a, b, c] = SCALE[mode] ?? SCALE.circle;
    return ms < a ? "مثل الفهد" : ms < b ? "سريع جداً" : ms < c ? "زين" : "تقدر أحسن";
  };
  // faster than a person can see and press (~100 ms): a guess, counted as «بدري»
  const GUESS_MS = 100;
  const buzz = (ms) => navigator.vibrate?.(ms);

  function circle(box, done) {
    let state = "idle", t0 = 0, timer = null;
    box.innerHTML = '<button type="button" class="rx-circle idle">اضغط عشان تبدأ</button><p class="rx-say">أول ما تخضرّ الدائرة اضغطها</p>';
    const btn = box.querySelector(".rx-circle"), say = box.querySelector(".rx-say");
    const set = (cls, text) => { btn.className = "rx-circle " + cls; btn.textContent = text; };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (state === "idle" || state === "early") {
        state = "wait"; set("", "استنّى…"); say.textContent = "لا تضغط قبل لا تخضرّ";
        timer = setTimeout(() => { state = "go"; t0 = now(); set("go", "الحين!"); }, 1300 + Math.random() * 2500);
      } else if (state === "wait") {
        clearTimeout(timer); state = "early"; set("idle", "بدري! مرة ثانية"); say.textContent = "ضغطت قبل لا تخضرّ"; buzz(80);
      } else if (state === "go") {
        const ms = Math.round(now() - t0);
        if (ms < GUESS_MS) { state = "early"; set("idle", "بدري! مرة ثانية"); say.textContent = "ضغطت قبل لا تشوفها"; buzz(80); return; }
        state = "done"; buzz(20); done(ms);
      }
    });
  }

  function blocks(box, done) {
    let round = 0, t0 = 0, times = [], playing = false, timer = null;
    box.innerHTML = '<div class="rx-field"><button type="button" class="rx-start">ابدأ</button></div><div class="rx-dots"></div><p class="rx-say">خمس بلوكات تطلع، اضغطها بأسرع ما تقدر</p>';
    const field = box.querySelector(".rx-field"), dots = box.querySelector(".rx-dots");
    const paint = () => { dots.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < round ? "on" : ""}"></i>`).join(""); };
    const next = () => {
      field.innerHTML = ""; paint();
      timer = setTimeout(() => {
        const w = field.clientWidth - 70, h = field.clientHeight - 70;
        const b = document.createElement("button");
        b.type = "button"; b.className = "rx-tgt"; b.setAttribute("aria-label", "اضغط");
        b.style.left = 8 + Math.random() * Math.max(10, w) + "px"; b.style.top = 8 + Math.random() * Math.max(10, h) + "px";
        field.appendChild(b); t0 = now();
      }, 500 + Math.random() * 1300);
    };
    field.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".rx-start")) { e.preventDefault(); round = 0; times = []; playing = true; return next(); }
      if (!playing) return;
      if (e.target.closest(".rx-tgt")) {
        e.preventDefault();
        // (a block hit faster than a person can see it: a guess, the round starts over)
        if (now() - t0 < GUESS_MS) { clearTimeout(timer); buzz(80); return next(); }
        buzz(10);
        times.push(now() - t0); round++;
        if (round < 5) return next();
        playing = false; paint();
        done(Math.round(times.reduce((a, b) => a + b, 0) / times.length), Math.round(Math.min(...times)));
      } else if (!field.querySelector(".rx-tgt")) {
        // a tap before the block shows: the round starts over (no guessing)
        clearTimeout(timer); buzz(80); next();
      }
    });
    paint();
  }

  // the game's own look (the page around it gives the colours and textures: --tex-lava / --tex-dark, --f-num)
  const CSS = `
  .rx-circle { display: grid; place-items: center; width: min(68vw, 250px); aspect-ratio: 1; margin: 6px auto 12px; border: 0; border-radius: 50%; cursor: pointer;
    font: inherit; font-size: 18px; font-weight: 900; color: #fff; touch-action: manipulation; -webkit-user-select: none; user-select: none;
    background: radial-gradient(circle at 40% 35%, #ff6a55, #b5121b); box-shadow: 0 0 0 9px #1a1112, 0 22px 44px -14px rgb(239 59 45 / .8); }
  .rx-circle.go { background: radial-gradient(circle at 40% 35%, #8bff6a, #2f9e1e); box-shadow: 0 0 0 9px #1a1112, 0 0 60px -6px #5fd35f; }
  .rx-circle.idle { background: radial-gradient(circle at 40% 35%, #3a2f30, #1a1314); }
  .rx-say { margin: 0; text-align: center; font-size: 13px; color: rgba(255,255,255,.6); }
  .rx-field { position: relative; height: min(56vh, 380px); border-radius: 20px; overflow: hidden; touch-action: manipulation; -webkit-user-select: none; user-select: none;
    background: linear-gradient(rgb(14 10 10 / .55), rgb(14 10 10 / .55)), var(--tex-dark, #1a1314) 0 0 / 24px 24px; image-rendering: pixelated; box-shadow: inset 0 0 0 1.5px #000, inset 0 8px 14px -6px #000; }
  .rx-start { position: absolute; inset: 0; margin: auto; width: 140px; height: 54px; border: 0; border-radius: 14px; cursor: pointer; font: inherit; font-size: 16px; font-weight: 900; color: #fff;
    background: radial-gradient(circle at 40% 30%, #ff6a55, #b5121b); box-shadow: 0 0 0 2px #000; }
  .rx-tgt { position: absolute; width: 62px; height: 62px; border: 0; border-radius: 16px; cursor: pointer; image-rendering: pixelated;
    background: var(--tex-lava, #ff8a1f) 0 0 / 14px 14px; box-shadow: inset 0 0 0 2px #000, 0 0 24px -4px #ff8a1f; animation: rxpop .18s cubic-bezier(.3,1.6,.5,1); }
  @keyframes rxpop { from { transform: scale(0); } }
  .rx-dots { display: flex; gap: 7px; justify-content: center; margin: 12px 0 8px; }
  .rx-dots i { width: 11px; height: 11px; border-radius: 50%; background: #2a2223; }
  .rx-dots i.on { background: #ff8a1f; box-shadow: 0 0 8px #ff8a1f; }`;
  if (!document.getElementById("nk-rx-css")) {
    const st = document.createElement("style");
    st.id = "nk-rx-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  window.NKRx = { play: (box, mode, done) => (mode === "blocks" ? blocks : circle)(box, done), rank };
})();
