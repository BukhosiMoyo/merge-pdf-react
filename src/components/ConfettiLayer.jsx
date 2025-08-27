import { useEffect, useRef } from "react";

/** A full‑screen canvas that listens for `window` "celebrate" events. */
export default function ConfettiLayer() {
  const ref = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // Always cover the viewport and sit above everything
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    function resize() {
      canvas.style.position = "fixed";
      canvas.style.inset = "0";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "2147483647"; // topmost
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);

    let particles = [];
    const gravity = 0.25;
    const drag = 0.985;

    function spawnBurst({ count = 160, spread = 70, startY = window.innerHeight * 0.3 }) {
      const cx = window.innerWidth / 2;
      const cy = startY;
      const colors = ["#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#F43F5E", "#22D3EE"];

      for (let i = 0; i < count; i++) {
        const angle = (Math.random() * spread - spread / 2) * (Math.PI / 180) + Math.PI / 2;
        const speed = 8 + Math.random() * 6;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 3,
          vy: Math.sin(angle) * speed * -1,
          size: 6 + Math.random() * 6,
          color: colors[(Math.random() * colors.length) | 0],
          life: 90 + (Math.random() * 40),
          rotation: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.2,
        });
      }
      loop();
    }

    function loop() {
      if (rafRef.current) return; // already running
      const step = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles = particles.filter(p => p.life > 0);
        for (const p of particles) {
          p.vx *= drag;
          p.vy += gravity;
          p.x += p.vx;
          p.y += p.vy;
          p.rotation += p.vr;
          p.life -= 1;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 100));
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
        if (particles.length) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = 0;
        }
      };
      rafRef.current = requestAnimationFrame(step);
    }

    // Listen for global "celebrate" events from anywhere in the app
    function onCelebrate(e) {
      const { intensity = "big" } = e.detail || {};
      if (intensity === "small") spawnBurst({ count: 80, spread: 60 });
      else spawnBurst({ count: 200, spread: 90 });
    }
    window.addEventListener("celebrate", onCelebrate);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("celebrate", onCelebrate);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas id="confetti-layer" ref={ref} />;
}
