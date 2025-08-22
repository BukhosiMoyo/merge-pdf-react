// src/utils/confetti.js
// One, full‑screen canvas; sizing is handled by canvas-confetti (resize:true)

let _canvas = null;
let _confetti = null;

function ensureCanvas() {
  if (_canvas && document.body.contains(_canvas)) return _canvas;

  const c = document.createElement("canvas");
  c.id = "confetti-layer";
  // IMPORTANT: no width/height CSS, no manual DPR transforms
  Object.assign(c.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "2147483647", // top
  });
  document.body.appendChild(c);
  _canvas = c;
  return _canvas;
}

export async function fireConfetti() {
  const canvas = ensureCanvas();

  // lazy-load and create a confetti instance that manages size for us
  if (!_confetti) {
    const { default: confetti } = await import("canvas-confetti");
    _confetti = confetti.create(canvas, { resize: true, useWorker: true });
  }

  const burst = (x) =>
    _confetti({
      particleCount: 140,
      startVelocity: 55,
      spread: 80,
      ticks: 220,
      origin: { x, y: 0.45 }, // middle height
      scalar: 1.0,
      colors: ["#f59e0b", "#fbbf24", "#22c55e", "#60a5fa", "#ef4444"],
    });

  // three bursts across the screen
  burst(0.18);
  burst(0.5);
  burst(0.82);

  // optional: clear after it settles
  setTimeout(() => {
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 3000);
}
