// src/pages/Download.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import RatingDialog from "../components/RatingDialog.jsx";
import { useLocale } from "../state/LocaleContext.jsx";
import StatsAndFAQ from "../components/StatsAndFAQ.jsx";
import {
  Download as IcDownload,
  FileText as IcDoc,
  RotateCcw as IcRotate,
  Eye as IcEye,
  Copy as IcCopy,
  Check as IcCheck,
} from "lucide-react";

/* helpers */
function fmtBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtPages(n) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n} page${n === 1 ? "" : "s"}`;
}

function formatTimeRemaining(expiresAt) {
  if (!expiresAt) return null;
  
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry - now;
  
  if (diffMs <= 0) return "expired";
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 0) {
    return `~${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else if (diffMinutes > 0) {
    return `~${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  } else {
    return "less than 1 minute";
  }
}

/* Localized strings */
const STRINGS = {
  en: {
    ready: "Your file is ready",
    merged: "We merged your PDFs into a single document.",
    download: "Download",
    viewPdf: "View PDF",
    matchAgain: "Match again",
    copyLink: "Copy link",
    linkCopied: "Link copied",
    expiresIn: "Link expires in",
    expired: "This link has expired",
    expiredMessage: "Files are deleted after 1 hour. Ask the sender to resend.",
    startNewMerge: "Start a new merge",
    home: "Home",
    type: "PDF",
  },
  af: {
    ready: "Jou lêer is gereed",
    merged: "Ons het jou PDF's in een dokument saamgevoeg.",
    download: "Laai af",
    viewPdf: "Bekyk PDF",
    matchAgain: "Voeg weer saam",
    copyLink: "Kopieer skakel",
    linkCopied: "Skakel gekopieer",
    expiresIn: "Skakel verval in",
    expired: "Hierdie skakel het verval",
    expiredMessage: "Lêers word na 1 uur verwyder. Vra die sender om weer te stuur.",
    startNewMerge: "Begin nuwe samesmelting",
    home: "Tuis",
    type: "PDF",
  },
  zu: {
    ready: "Ifayela lakho selilungile",
    merged: "Sihlanganise ama-PDF akho abe yidokhumenti eyodwa.",
    download: "Landa",
    viewPdf: "Buka i-PDF",
    matchAgain: "Hlanganisa futhi",
    copyLink: "Kopisha isixhumanisi",
    linkCopied: "Isixhumanisi sikopishelwe",
    expiresIn: "Isixhumanisi siphelelwa ngemizuzu",
    expired: "Lesi sixhumanisi siphelelwe",
    expiredMessage: "Amafayela asuswa ngemuva kwe-1 ihora. Cela umthumeli athumele futhi.",
    startNewMerge: "Qala ukuhlanganisa okusha",
    home: "Ikhaya",
    type: "PDF",
  },
  xh: {
    ready: "Ifayile yakho ilungile",
    merged: "Sidibanise ii-PDF zakho zaba luxwebhu olunye.",
    download: "Khuphela",
    viewPdf: "Jonga i-PDF",
    matchAgain: "Dibanisa kwakhona",
    copyLink: "Kopa ikhonkco",
    linkCopied: "Ikhonkco likopishelwe",
    expiresIn: "Ikhonkco liphelelwa ngemizuzu",
    expired: "Eli khonkco liphelelwe",
    expiredMessage: "Amafayela asuswa ngemuva kwe-1 ihora. Cela umthumeli athumele kwakhona.",
    startNewMerge: "Qala ukudibanisa okutsha",
    home: "Ikhaya",
    type: "PDF",
  },
};

export default function Download() {
  const { id, name } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get download URL from navigation state or fallback to query params for backward compatibility
  const downloadUrl = location.state?.downloadUrl || new URLSearchParams(location.search).get("url") || "";
  const fileName = location.state?.fileName || decodeURIComponent(name || "merged.pdf");
  const expiresAt = location.state?.expiresAt || null;

  const { locale, setLocale } = useLocale();
  const t = STRINGS[locale] || STRINGS.en;

  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "light"
  );
  const [fileSize, setFileSize] = useState(null);
  const [pageCount, setPageCount] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const dlRef = useRef(null);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  // Check if link is expired
  useEffect(() => {
    if (expiresAt) {
      const now = new Date();
      const expiry = new Date(expiresAt);
      setIsExpired(now > expiry);
    }
  }, [expiresAt]);

  // Fetch file metadata
  useEffect(() => {
    if (!downloadUrl || isExpired) return;
    
    let alive = true;
    (async () => {
      try {
        // First try to get metadata from the API if we have an ID
        if (id) {
          try {
            const metaResponse = await fetch(`${import.meta.env.VITE_API_BASE}/v1/meta/${id}`);
            if (metaResponse.ok) {
              const meta = await metaResponse.json();
              if (alive) {
                if (meta.bytes) setFileSize(meta.bytes);
                if (meta.pages) setPageCount(meta.pages);
                if (meta.expires_at && !expiresAt) {
                  // Update expiry if not already set
                  const newExpiry = new Date(meta.expires_at);
                  setIsExpired(new Date() > newExpiry);
                }
              }
              return; // Successfully got metadata, no need to fetch file
            }
          } catch (err) {
            console.warn("Failed to fetch metadata, falling back to file HEAD request");
          }
        }

        // Fallback to HEAD request
        const r = await fetch(downloadUrl, { method: "HEAD" });
        if (alive && r.ok) {
          const len = r.headers.get("content-length");
          if (len) setFileSize(Number(len));
          
          // Try to get page count from content-disposition or other headers
          const disposition = r.headers.get("content-disposition");
          if (disposition) {
            const pageMatch = disposition.match(/pages=(\d+)/i);
            if (pageMatch) setPageCount(Number(pageMatch[1]));
          }
        }
      } catch {
        if (alive) {
          setFileSize(null);
          setPageCount(null);
        }
      }
    })();
    return () => { alive = false; };
  }, [downloadUrl, id, expiresAt, isExpired]);

  // Focus download button on mount
  useEffect(() => {
    dlRef.current?.focus();
  }, []);

  // Set page title for SEO
  useEffect(() => {
    if (fileName) {
      document.title = `Download ${fileName} - Merge PDF`;
    }
  }, [fileName]);

  // Show rating modal once per day
  useEffect(() => {
    const key = "rate_cooldown_ts";
    const last = Number(localStorage.getItem(key) || "0");
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    if (Date.now() - last > oneDayMs) {
      const timer = setTimeout(() => setShowRating(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleCloseRating() {
    localStorage.setItem("rate_cooldown_ts", String(Date.now()));
    setShowRating(false);
  }

  function handleViewPdf() {
    const viewUrl = `/${locale}/view/${id}/${encodeURIComponent(fileName)}`;
    // Open viewer in new tab with download URL in state
    const newWindow = window.open(viewUrl, '_blank');
    if (newWindow) {
      // Pass the download URL via localStorage as a fallback
      const viewerData = {
        downloadUrl: downloadUrl,
        fileName: fileName,
        expiresAt: expiresAt
      };
      localStorage.setItem(`viewer_${id}`, JSON.stringify(viewerData));
      
      // Clean up after 5 minutes
      setTimeout(() => {
        localStorage.removeItem(`viewer_${id}`);
      }, 5 * 60 * 1000);
    }
  }

  function handleDownload() {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  }

  function handleMatchAgain() {
    navigate(`/${locale}`);
  }

  async function handleCopyLink() {
    const shareUrl = `${window.location.origin}/${locale}/download/${id}/${encodeURIComponent(fileName)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 3000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  }

  function handleStartNewMerge() {
    navigate(`/${locale}`);
  }

  function handleGoHome() {
    navigate(`/${locale}`);
  }

  // Truncate filename for display if too long
  const displayName = fileName.length > 50 ? fileName.slice(0, 47) + "..." : fileName;

  // If link is expired, show expired state
  if (isExpired) {
    return (
      <Layout
        headerProps={{
          theme,
          onToggleTheme: toggleTheme,
          locale,
          setLocale,
        }}
      >
        <div className="downloadShell">
          <div className="downloadCard">
            <div className="downloadIcon">
              <IcDoc size={32} />
            </div>
            <h2 className="downloadTitle">{t.expired}</h2>
            <p className="downloadSubtext">{t.expiredMessage}</p>
            <div className="quickActions">
              <button className="quickAction primary" onClick={handleStartNewMerge}>
                <IcRotate size={16} />
                <span>{t.startNewMerge}</span>
              </button>
              <button className="quickAction" onClick={handleGoHome}>
                <span>{t.home}</span>
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // If no download URL, show error state
  if (!downloadUrl) {
    return (
      <Layout
        headerProps={{
          theme,
          onToggleTheme: toggleTheme,
          locale,
          setLocale,
        }}
      >
        <div className="downloadShell">
          <div className="downloadCard">
            <div className="downloadIcon">
              <IcDownload size={32} />
            </div>
            <h2 className="downloadTitle">Download not found</h2>
            <p className="downloadSubtext">The download link is invalid or has expired.</p>
            <button className="downloadButton" onClick={handleStartNewMerge}>
              <IcRotate size={20} />
              <span>Start new merge</span>
            </button>
          </div>
        </div>
      </Layout>
    );
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
      {/* Download success UI */}
      <div className="downloadShell">
        <div className="downloadCard">
          {/* Download icon */}
          <div className="downloadIcon">
            <IcDownload size={32} />
          </div>
          
          {/* Main heading */}
          <h2 className="downloadTitle">{t.ready}</h2>
          
          {/* Subtext */}
          <p className="downloadSubtext">{t.merged}</p>
          
          {/* File info pill */}
          <div className="fileInfoPill">
            <span className="fileType">{t.type}</span>
            <span className="pillSeparator">•</span>
            <span className="fileSize">{fmtBytes(fileSize)}</span>
            <span className="pillSeparator">•</span>
            <span className="pageCount">{fmtPages(pageCount)}</span>
          </div>
          
          {/* Primary download button */}
          <a 
            ref={dlRef} 
            href={downloadUrl} 
            className="downloadButton" 
            download={fileName}
            title={fileName}
          >
            <IcDownload size={20} />
            <span>{t.download} {displayName}</span>
          </a>
          
          {/* Quick Actions */}
          <div className="quickActions">
            <button className="quickAction" onClick={handleViewPdf}>
              <IcEye size={16} />
              <span>{t.viewPdf}</span>
            </button>
            <button className="quickAction" onClick={handleDownload}>
              <IcDownload size={16} />
              <span>{t.download}</span>
            </button>
            <button className="quickAction" onClick={handleMatchAgain}>
              <IcRotate size={16} />
              <span>{t.matchAgain}</span>
            </button>
            <button className="quickAction" onClick={handleCopyLink}>
              <IcCopy size={16} />
              <span>{t.copyLink}</span>
            </button>
          </div>

          {/* Expiry hint */}
          {expiresAt && !isExpired && (
            <div className="expiryHint">
              {t.expiresIn} {formatTimeRemaining(expiresAt)}
            </div>
          )}
        </div>
      </div>

      {/* Counter + FAQ stacked BELOW the card */}
      <StatsAndFAQ />

      {/* Rating Modal */}
      <RatingDialog
        open={showRating}
        onClose={handleCloseRating}
        locale={locale}
        apiBase={import.meta.env.VITE_API_BASE}
        siteName="Merge PDF"
      />

      {/* Copy success toast */}
      {showCopiedToast && (
        <div className="copyToast" role="status" aria-live="polite">
          <IcCheck size={16} />
          <span>{t.linkCopied} (expires in 1 hour)</span>
        </div>
      )}
    </Layout>
  );
}
