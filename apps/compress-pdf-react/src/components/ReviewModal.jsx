import { useEffect, useState } from "react";

/**
 * ReviewModal — responsive, overflow-safe
 *
 * Props:
 *  - open: boolean
 *  - onClose: fn()
 *  - onSubmit: fn(starsNumber)
 */
export default function ReviewModal({ open, onClose, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(null);
  const active = hover ?? rating;

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.55)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  };

  const sheet = {
    width: "100%",
    maxWidth: 440,             // slightly wider for bigger title/button
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: 16,
    boxShadow: "0 16px 40px rgba(0,0,0,.35)",
    overflow: "hidden",
  };

  const header = {
    padding: "16px 18px",
    borderBottom: "1px solid #1f2937",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  const title = {
    color: "#e2e8f0",
    fontWeight: 900,
    // noticeably bigger on all screens but still responsive
    fontSize: "clamp(18px, 3.8vw, 24px)",
    lineHeight: 1.2,
    margin: 0,
  };

  const closeBtn = {
    border: "none",
    background: "transparent",
    // red close as requested
    color: "#ef4444",
    fontSize: 22,
    cursor: "pointer",
    lineHeight: 1,
  };

  const body = { padding: 18 };

  // ⭐ container is wrap-safe and cannot overflow its parent
  const starsRow = {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    maxWidth: "100%",
    overflow: "hidden",
    marginTop: 12,
    marginBottom: 8,
  };

  // Each star scales with viewport but stays within bounds
  const starBtn = (on) => ({
    border: "none",
    background: "transparent",
    cursor: "pointer",
    lineHeight: 1,
    padding: 8,
    fontSize: "clamp(26px, 8vw, 44px)",
    outline: "none",
    color: on ? "#f59e0b" : "#475569",
    transition: "transform .08s ease, color .15s ease",
  });

  // Bigger, primary submit button
  const footer = {
    display: "flex",
    justifyContent: "center",
    marginTop: 14,
  };
  const primary = {
    padding: "14px 22px",
    borderRadius: 14,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 900,
    fontSize: "clamp(15px, 3.6vw, 18px)",
    cursor: rating > 0 ? "pointer" : "not-allowed",
    opacity: rating > 0 ? 1 : 0.6,
    minWidth: 180,
  };

  // Emoji scale & mapping (default is disappointed)
  const moodWrap = {
    textAlign: "center",
    marginTop: 6,
    fontSize: "clamp(30px, 10vw, 54px)",
  };
  const mood = active >= 5 ? "😄"
            : active === 4 ? "🙂"
            : active === 3 ? "😐"
            : active === 2 ? "☹️"
            : active === 1 ? "😣"
            : "😞"; // default when no stars yet

  const Star = ({ filled }) => (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      role="img"
      aria-hidden="true"
      style={{ transform: filled ? "translateY(-1px)" : "none" }}
    >
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <h3 style={title}>Rate your experience</h3>
          <button style={closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={body}>
          <div style={{ color: "#cbd5e1", textAlign: "center", fontWeight: 700 }}>
            How many stars would you give our PDF compressor?
          </div>

          <div style={starsRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const on = n <= (hover ?? rating);
              return (
                <button
                  key={n}
                  style={starBtn(on)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(n)}
                  onBlur={() => setHover(null)}
                  onClick={() => setRating(n)}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star filled={on} />
                </button>
              );
            })}
          </div>

          <div style={moodWrap} aria-hidden="true">{mood}</div>

          <div style={footer}>
            <button
              style={primary}
              disabled={rating < 1}
              onClick={() => rating > 0 && onSubmit?.(rating)}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
