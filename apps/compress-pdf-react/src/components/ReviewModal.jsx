import React from "react";

const API_BASE = import.meta.env?.VITE_API_BASE || "https://api.compresspdf.co.za";

export default function ReviewModal({ open, onClose, onSubmit }) {
  const [stars, setStars] = React.useState(0);     // keep neutral default
  const [hover, setHover] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  if (!open) return null;

  async function handleSubmit() {
    if (stars < 1 || stars > 5) {
      setErr("Please choose a rating (1–5 stars).");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${API_BASE}/v1/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: Number(stars) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json(); // { ok:true, reviewCount, ratingValue }
      // tell parent it worked so it can refresh anything it wants
      onSubmit?.(Number(stars), data);
      onClose?.();
    } catch (e) {
      setErr("Could not submit your rating. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // simple inline styles to match the rest of your app
  const overlay = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
    backdropFilter: "blur(2px)",
  };
  const modal = {
    width: "min(420px, 92vw)",
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: 16,
    padding: 18,
    color: "#e2e8f0",
    boxShadow: "0 18px 40px rgba(0,0,0,.45)",
  };
  const starRow = { display: "flex", gap: 6, justifyContent: "center", margin: "12px 0 6px" };
  const btn = {
    padding: "10px 16px", borderRadius: 12, fontWeight: 800, cursor: "pointer", border: "none",
  };

  const current = hover || stars;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Rate your experience</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ ...btn, background: "transparent", color: "#94a3b8", padding: 6 }}
          >
            ×
          </button>
        </div>

        {/* Stars */}
        <div style={starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setStars(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 32,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              <span style={{ color: n <= current ? "#fbbf24" : "#334155" }}>★</span>
            </button>
          ))}
        </div>

        {/* Emoji hint */}
        <div style={{ textAlign: "center", fontSize: 28, marginBottom: 8 }}>
          {current >= 5 ? "😄" : current === 4 ? "🙂" : current === 3 ? "😐" : current === 2 ? "🙁" : current === 1 ? "😣" : "⭐"}
        </div>

        {/* Error */}
        {err && (
          <div style={{ color: "#fca5a5", textAlign: "center", marginBottom: 8, fontSize: 14 }}>
            {err}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onClose}
            style={{ ...btn, background: "#374151", color: "#fff" }}
            disabled={busy}
          >
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            style={{
              ...btn,
              background: busy ? "#334155" : "#2563eb",
              color: "#fff",
              boxShadow: busy ? "none" : "0 10px 24px rgba(30,64,175,.45)",
            }}
          >
            {busy ? "Submitting…" : "Submit"}
          </button>
        </div>

        <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
          Thanks for helping us improve!
        </div>
      </div>
    </div>
  );
}
