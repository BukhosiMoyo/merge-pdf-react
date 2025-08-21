// apps/compress-pdf-react/src/components/ReviewModal.jsx
import React, { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function ReviewModal({ open, onClose, onSubmit }) {
  const [stars, setStars] = useState(5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  async function submitReview() {
    try {
      setBusy(true);
      setErr("");
      // 🔗 POST to your API
      const res = await fetch(`${API_BASE}/v1/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: stars }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Failed to submit review");
      }
      onSubmit?.(stars); // keep your existing callback
      onClose?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const starStyle = (i) => ({
    cursor: "pointer",
    fontSize: 28,
    color: i <= stars ? "#fbbf24" : "#475569",
    transition: "color .15s",
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          background: "#0f172a",
          border: "1px solid #1f2937",
          borderRadius: 16,
          padding: 20,
          color: "#e2e8f0",
          textAlign: "center",
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>
          How was your experience?
        </h3>
        <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 14 }}>
          Rate CompressPDF.co.za
        </div>

        {/* Stars */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              role="button"
              aria-label={`${i} star`}
              onClick={() => setStars(i)}
              onMouseEnter={() => setStars(i)}
              style={starStyle(i)}
            >
              ★
            </span>
          ))}
        </div>

        {/* Emoji */}
        <div style={{ fontSize: 28, marginBottom: 16 }}>
          {stars <= 2 ? "😕" : stars === 3 ? "🙂" : stars === 4 ? "😄" : "🤩"}
        </div>

        {err && <div style={{ color: "#fca5a5", marginBottom: 10 }}>{err}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #334155",
              background: "transparent",
              color: "#e2e8f0",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>
          <button
            onClick={submitReview}
            disabled={busy}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
              minWidth: 120,
            }}
          >
            {busy ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
