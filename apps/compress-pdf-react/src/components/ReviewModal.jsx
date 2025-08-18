import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

export default function ReviewModal({ open, onClose, onSubmit }) {
  const [stars, setStars] = useState(0);

  const face = useMemo(() => {
    if (stars <= 1) return "😖";
    if (stars === 2) return "🙁";
    if (stars === 3) return "😐";
    if (stars === 4) return "🙂";
    if (stars >= 5) return "😄";
    return "⭐";
  }, [stars]);

  if (!open) return null;

  const Star = ({ i }) => (
    <button
      onClick={() => setStars(i)}
      aria-label={`Rate ${i} star${i > 1 ? "s" : ""}`}
      style={{
        fontSize: 34,           // make stars big
        lineHeight: "34px",
        cursor: "pointer",
        background: "none",
        border: "none",
        padding: "0 8px",
        color: i <= stars ? "#fbbf24" : "#9ca3af", // gold/gray
        transition: "transform .1s ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.9)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {"\u2605" /* ★ */}
    </button>
  );

  return createPortal(
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backdropFilter: "blur(4px)",
        background: "rgba(0,0,0,0.45)",
        zIndex: 10000,               // very high
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          maxWidth: "92vw",
          borderRadius: 14,
          background: "#111827",
          color: "#fff",
          boxShadow: "0 20px 50px rgba(0,0,0,.45)",
          padding: 22,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Rate your experience</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: "#9ca3af", fontSize: 22, cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <p style={{ margin: "0 0 12px", color: "#d1d5db", fontSize: 14 }}>
          How was PDF compression?
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "6px 0 8px" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} i={i} />
          ))}
        </div>

        <div style={{ textAlign: "center", fontSize: 56, lineHeight: "1", margin: "4px 0 14px" }}>
          {face /* BIG emoji */}
        </div>

        <button
          onClick={() => onSubmit?.(stars || 5)}
          disabled={stars === 0}
          style={{
            width: "100%",
            borderRadius: 10,
            padding: "11px 14px",
            fontWeight: 700,
            cursor: stars ? "pointer" : "not-allowed",
            background: stars ? "#22c55e" : "#374151",
            color: "#0b1220",
            border: "none",
          }}
        >
          Submit
        </button>

        <p style={{ marginTop: 10, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
          You can close by clicking outside too.
        </p>
      </div>
    </div>,
    document.body
  );
}
