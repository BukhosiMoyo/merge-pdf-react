import { useEffect, useRef, useCallback } from "react";

/** A full‑screen canvas that listens for `window` "celebrate" events. */
export default function ConfettiLayer() {
  const ref = useRef(null);
  const rafRef = useRef(0);
  const timeoutRef = useRef(null);

  // Debounced resize handler
  const debouncedResize = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      const canvas = ref.current;
      if (!canvas) return;
      
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const ctx = canvas.getContext("2d");
      
      canvas.style.position = "fixed";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "2147483647"; // topmost
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }, 100);
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return; // Skip confetti if user prefers reduced motion
    }

    // Check if celebrations are disabled
    const celebrationsDisabled = localStorage.getItem('celebrations') === 'off';
    if (celebrationsDisabled) {
      return; // Skip confetti if user has disabled celebrations
    }

    // Initial setup
    debouncedResize();
    window.addEventListener("resize", debouncedResize);

    const ctx = canvas.getContext("2d");
    let particles = [];
    const gravity = 0.3;
    const drag = 0.98;

    // Brand colors that work well in both light and dark themes
    const colors = [
      "#3B82F6", // Blue
      "#10B981", // Emerald
      "#F59E0B", // Amber
      "#EF4444", // Red
      "#8B5CF6", // Violet
      "#06B6D4", // Cyan
      "#84CC16", // Lime
      "#F97316"  // Orange
    ];

    function spawnBurst({ 
      count = 120, 
      spread = 80, 
      startX = window.innerWidth / 2,
      startY = window.innerHeight * 0.2,
      scalar = 1.0 
    }) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.random() * spread - spread / 2) * (Math.PI / 180) + Math.PI / 2;
        const speed = (6 + Math.random() * 8) * scalar;
        particles.push({
          x: startX + (Math.random() - 0.5) * 20,
          y: startY,
          vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 4,
          vy: Math.sin(angle) * speed * -1,
          size: (4 + Math.random() * 8) * scalar,
          color: colors[(Math.random() * colors.length) | 0],
          life: 120 + (Math.random() * 60),
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          shape: Math.random() > 0.5 ? 'rect' : 'circle'
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
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 120));
          
          if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          }
          
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

    // Enhanced celebration with multiple bursts across the screen
    function onCelebrate(e) {
      const { intensity = "big" } = e.detail || {};
      
      if (intensity === "small") {
        // Single burst for small celebrations
        spawnBurst({ count: 60, spread: 60 });
      } else {
        // Multiple bursts across the screen for big celebrations
        const burstCount = 5 + Math.floor(Math.random() * 3); // 5-7 bursts
        const totalDuration = 2000; // 2 seconds
        const delayBetweenBursts = totalDuration / burstCount;
        
        for (let i = 0; i < burstCount; i++) {
          setTimeout(() => {
            const startX = Math.random() * window.innerWidth;
            const startY = window.innerHeight * (0.1 + Math.random() * 0.3);
            const scalar = 0.8 + Math.random() * 0.4;
            
            spawnBurst({
              count: 80 + Math.floor(Math.random() * 40),
              spread: 70 + Math.floor(Math.random() * 40),
              startX,
              startY,
              scalar
            });
          }, i * delayBetweenBursts);
        }
      }
    }

    window.addEventListener("celebrate", onCelebrate);

    return () => {
      window.removeEventListener("resize", debouncedResize);
      window.removeEventListener("celebrate", onCelebrate);
      cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [debouncedResize]);

  return <canvas id="confetti-layer" ref={ref} />;
}
