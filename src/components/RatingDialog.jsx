// src/components/RatingDialog.jsx
import React, { useEffect, useMemo, useState } from "react";
import { fireConfetti } from "../utils/confetti.js";

/**
 * RatingDialog
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - apiBase: string (POST /v1/reviews { rating, locale })
 *  - locale: string
 *  - siteName: string
 */
export default function RatingDialog({
  open,
  onClose,
  apiBase,
  locale = "en",
  siteName = "Merge PDF",
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);

  // Close with ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const faces = useMemo(() => ["😠", "☹️", "😐", "😊", "🤩"], []);
  const active = hover || rating;

  async function submit() {
    if (!rating || busy) return;
    setBusy(true);
    try {
      // best-effort capture; don't block UX if it fails
      await fetch(`${apiBase}/v1/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, locale }),
      }).catch(() => {});

      if (rating === 5) {
        // Full-screen confetti from utils; we manage canvas sizing there
        await fireConfetti();
        // Close just after burst starts so users still see it
        setTimeout(() => onClose?.(), 500);
      } else {
        onClose?.();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="ratingOverlay" role="dialog" aria-modal="true" aria-labelledby="rating-title">
      <div className="ratingCard">
        {/* Red X (replaces Maybe later) */}
        <button
          className="ratingClose"
          onClick={onClose}
          aria-label="Close rating popup"
          type="button"
        >
          ✕
        </button>

        <h3 id="rating-title" className="ratingTitle">How was the merge?</h3>
        <p className="ratingSub">
          Your quick rating helps improve <strong>{siteName}</strong> for everyone.
        </p>

        {/* Bigger boxed stars; .filled makes them gold via your CSS */}
        <div className="ratingStars" role="radiogroup" aria-label="Rate from 1 to 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`starBtn ${n <= (hover || rating) ? "filled" : ""}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              aria-pressed={n === rating}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              type="button"
            >
              <svg viewBox="0 0 24 24" className="starIcon" aria-hidden>
                <path d="M12 2.5l3.09 6.26 6.91 1.01-5 4.86 1.18 6.87L12 18.77 5.82 21.5 7 14.63l-5-4.86 6.91-1.01L12 2.5z" />
              </svg>
            </button>
          ))}
        </div>

        {/* Big emoji (size via CSS) */}
        <div className="moodEmoji" aria-hidden>
          {active ? faces[active - 1] : "🙂"}
        </div>

        <button
          className="primaryBtn ratingSubmit"
          onClick={submit}
          disabled={!rating || busy}
          type="button"
        >
          {busy ? "Submitting…" : "Submit rating"}
        </button>
      </div>
    </div>
  );
}
