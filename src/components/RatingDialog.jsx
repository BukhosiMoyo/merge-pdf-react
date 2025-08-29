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

  // Focus trap for accessibility
  useEffect(() => {
    if (!open) return;
    
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleTabKey = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleTabKey);
    firstElement?.focus();
    
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [open]);

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
        {/* Close button */}
        <button
          className="ratingClose"
          onClick={onClose}
          aria-label="Close rating popup"
          type="button"
        >
          ✕
        </button>

        <h3 id="rating-title" className="ratingTitle">Rate your merge</h3>
        <p className="ratingSub">
          How was the experience today?
        </p>

        {/* Star rating buttons */}
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

        {/* Mood emoji */}
        <div className="moodEmoji" aria-hidden>
          {active ? faces[active - 1] : "🙂"}
        </div>

        {/* Submit button */}
        <button
          className="ratingSubmit"
          onClick={submit}
          disabled={!rating || busy}
          type="button"
        >
          {busy ? "Submitting…" : "Submit rating"}
        </button>
        
        {/* Dismiss button */}
        <button
          className="nextAction"
          onClick={onClose}
          type="button"
          style={{ marginTop: '16px', width: '100%' }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
