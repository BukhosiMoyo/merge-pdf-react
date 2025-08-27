// src/pages/Download.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import RatingDialog from "../components/RatingDialog.jsx";
import { useLocale } from "../state/LocaleContext.jsx";
import StatsAndFAQ from "../components/StatsAndFAQ.jsx"; // ⬅️ add this import
import {
  Download as IcDownload,
  Link2 as IcLink,
  ExternalLink as IcOpen,
  Home as IcHome,
  FileText as IcDoc,
  Send as IcSend,
  X as IcX,
} from "lucide-react";

/* helpers */
function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}
function fmtBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/* (optional) minimal strings so you can see the switch working on this page */
const STRINGS = {
  en: {
    ready: "Your file is ready",
    merged: "We merged your PDFs into a single document.",
    download: "Download PDF",
    copy: "Copy link",
    copied: "Copied",
    open: "Open PDF",
    new: "New merge",
    email: "Email PDF",
    type: "PDF",
  },
  af: {
    ready: "Jou lêer is gereed",
    merged: "Ons het jou PDF's in een dokument saamgevoeg.",
    download: "Laai PDF af",
    copy: "Kopieer skakel",
    copied: "Gekopieer",
    open: "Maak PDF oop",
    new: "Nuwe samesmelting",
    email: "E-pos PDF",
    type: "PDF",
  },
  zu: {
    ready: "Ifayela lakho selilungile",
    merged: "Sihlanganise ama-PDF akho abe yidokhumenti eyodwa.",
    download: "Landa i-PDF",
    copy: "Kopisha isixhumanisi",
    copied: "Kukopishekile",
    open: "Vula i-PDF",
    new: "Ukuhlanganisa okusha",
    email: "Thumela i-PDF nge-imeyili",
    type: "PDF",
  },
  xh: {
    ready: "Ifayile yakho ilungile",
    merged: "Sidibanise ii-PDF zakho zaba luxwebhu olunye.",
    download: "Khuphela i-PDF",
    copy: "Kopa ikhonkco",
    copied: "Ikhutshelwe",
    open: "Vula i-PDF",
    new: "Idibaniso entsha",
    email: "Thumela i-PDF nge-imeyili",
    type: "PDF",
  },
};

function EmailModal({ open, onClose, defaultName, defaultFrom, downloadUrl, fileName }) {
  const [fromName, setFromName] = useState(defaultName || "");
  const [fromEmail, setFromEmail] = useState(defaultFrom || "");
  const [toEmail, setToEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { if (open) setMsg(""); }, [open]);
  if (!open) return null;

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await fetch(`${import.meta.env.VITE_API_BASE}/v1/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_name: fromName,
          from_email: fromEmail,
          to_email: toEmail,
          file_url: downloadUrl,
          file_name: fileName,
          tool: "merge",
        }),
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setMsg("Sent! Check the recipient’s inbox."); setToEmail(""); }
      else { setMsg(j?.error?.message || "Could not send email."); }
    } catch (err) {
      setMsg(err.message || "Network error.");
    } finally { setBusy(false); }
  }

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard">
        <div className="modalHead">
          <h3>Email this PDF</h3>
          <button className="iconBtn small" onClick={onClose} aria-label="Close"><IcX size={18}/></button>
        </div>
        <form onSubmit={submit} className="modalBody">
          <div className="fieldRow"><label>Your name</label>
            <input required value={fromName} onChange={e=>setFromName(e.target.value)} placeholder="Jane Doe"/>
          </div>
          <div className="fieldRow"><label>Your email</label>
            <input required type="email" value={fromEmail} onChange={e=>setFromEmail(e.target.value)} placeholder="you@example.com"/>
          </div>
          <div className="fieldRow"><label>Send to</label>
            <input required type="email" value={toEmail} onChange={e=>setToEmail(e.target.value)} placeholder="recipient@example.com"/>
          </div>
          <div className="hintRow">We’ll include a short message with a link to <strong>{fileName}</strong>.</div>
          {msg && <div className="accentNotice" style={{marginTop:8}}>{msg}</div>}
          <div className="modalActions">
            <button type="button" className="btnGhost" onClick={onClose}>Cancel</button>
            <button type="submit" className="primaryBtn" disabled={busy}><IcSend size={18}/> {busy ? "Sending…" : "Send email"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Download() {
  const q = useQuery();
  const nav = useNavigate();
  const url = q.get("url") || "";
  const name = q.get("name") || "merged.pdf";

  const { locale, setLocale } = useLocale();
  const t = STRINGS[locale] || STRINGS.en;

  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "light"
  );
  const [size, setSize] = useState(null);
  const [copied, setCopied] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const dlRef = useRef(null);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(url, { method: "HEAD" });
        const len = r.headers.get("content-length");
        if (alive) setSize(len ? Number(len) : null);
      } catch {
        if (alive) setSize(null);
      }
    })();
    return () => { alive = false; };
  }, [url]);

  useEffect(() => { dlRef.current?.focus(); }, []);

  useEffect(() => {
    const key = "rate_cooldown_ts";
    const last = Number(localStorage.getItem(key) || "0");
    if (Date.now() - last > 12 * 60 * 60 * 1000) {
      const t = setTimeout(() => setShowRating(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);
  function handleCloseRating() {
    localStorage.setItem("rate_cooldown_ts", String(Date.now()));
    setShowRating(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <Layout
      headerProps={{
        theme,
        onToggleTheme: toggleTheme,
        locale,
        setLocale,
      }}
    >
      {/* ⬇️ single-column wrapper instead of .appShell/grid */}
      <main className="downloadStack">
        <section className="dlCard">
          <div className="dlPeel"><IcDownload size={18} /></div>

          <h1 className="dlH1">{t.ready}</h1>
          <p className="dlSub">{t.merged}</p>

          <a ref={dlRef} href={url} className="primaryDownloadBtn" download={name}>
            <IcDownload size={20} /> {t.download}
          </a>

          <div className="dlFileRow" title={name}>
            <span className="dlBadge"><IcDoc size={14} /> {t.type}</span>
            <span className="dlName">{name}</span>
            <span className="dlDot">•</span>
            <span className="dlSize">{fmtBytes(size)}</span>
          </div>

          <div className="dlActionsRow">
            <button className="btnGhost btnGhost--outlined2" onClick={copyLink}>
              <IcLink size={16} /> {copied ? t.copied : t.copy}
            </button>
            <a className="btnGhost" href={url} target="_blank" rel="noreferrer">
              <IcOpen size={16} /> {t.open}
            </a>
            <button className="btnGhost" onClick={() => nav("/", { replace: true })}>
              <IcHome size={16} /> {t.new}
            </button>
            {/* Email flow can stay hidden/disabled if SMTP is not ready */}
            {/* <button className="btnGhost" onClick={() => setEmailOpen(true)}>
              <IcSend size={16} /> {t.email}
            </button> */}
          </div>
        </section>

        {/* ⬇️ Counter + FAQ stacked BELOW the card */}
        <StatsAndFAQ />
      </main>

      <EmailModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        defaultName=""
        defaultFrom=""
        downloadUrl={url}
        fileName={name}
      />

      <RatingDialog
        open={showRating}
        onClose={handleCloseRating}
        locale={locale}
        apiBase={import.meta.env.VITE_API_BASE}
        siteName="Merge PDF"
      />
    </Layout>
  );
}
