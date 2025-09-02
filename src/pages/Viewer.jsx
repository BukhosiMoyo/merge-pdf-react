// src/pages/Viewer.jsx
import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import PdfModal from "../components/PdfModal.jsx";
import Seo from "../components/Seo.jsx";
import { useLocale } from "../state/LocaleContext.jsx";
import { FileText as IcFile, RotateCcw as IcRotate } from "lucide-react";

// Constant friendly filename
const FRIENDLY_FILENAME = "Merge PDF File.pdf";

export default function Viewer() {
  const { id } = useParams(); // Only use id, ignore name parameter
  const location = useLocation();
  const navigate = useNavigate();
  const { locale } = useLocale();
  
  // Get fileUrl from navigation state, localStorage, or fallback to query params for backward compatibility
  const fileUrl = location.state?.downloadUrl || 
    (() => {
      try {
        const stored = localStorage.getItem(`viewer_${id}`);
        return stored ? JSON.parse(stored).downloadUrl : "";
      } catch {
        return "";
      }
    })() || 
    new URLSearchParams(location.search).get("url") || "";
  
  const fileName = FRIENDLY_FILENAME; // Always use friendly filename

  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "light"
  );
  const [pdfDocument, setPdfDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  // Load PDF document
  useEffect(() => {
    if (!fileUrl) {
      setError("No PDF URL provided");
      setLoading(false);
      return;
    }

    async function loadPDF() {
      try {
        setLoading(true);
        setError(null);
        
        // Load PDF.js if not already present
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        
        // Load PDF using PDF.js
        const pdf = await window.pdfjsLib.getDocument({ 
          url: fileUrl, 
          withCredentials: true 
        }).promise;
        
        setPdfDocument(pdf);
        setShowModal(true);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError("Failed to load PDF. The file may have expired or been removed.");
      } finally {
        setLoading(false);
      }
    }

    loadPDF();
  }, [fileUrl]);



  function handleCloseModal() {
    setShowModal(false);
    // Navigate back to the previous page or merge page
    navigate(`/${locale}`);
  }

  function handleStartNewMerge() {
    navigate(`/${locale}`);
  }

  if (error) {
    return (
      <>
        <Seo 
          title="Preview Merged PDF — Free PDF Tools (South Africa)"
          description="Preview your merged PDF in your browser. Download or start a new merge — fast, private, and free in South Africa."
          canonicalPath={`/${locale}/view`}
          noindex={true}
        />
        <Layout
          headerProps={{
            theme,
            onToggleTheme: toggleTheme,
            locale,
            setLocale: () => {},
          }}
        >
        <div className="viewerShell">
          <div className="viewerCard">
            <div className="viewerIcon">
              <IcFile size={32} />
            </div>
            <h2 className="viewerTitle">This link has expired</h2>
            <p className="viewerSubtext">Files are deleted after 1 hour. Ask the sender to re-share.</p>
            <div className="viewerActions">
              <button className="viewerAction primary" onClick={handleStartNewMerge}>
                <IcRotate size={16} />
                <span>Start new merge</span>
              </button>
            </div>
          </div>
        </div>
        </Layout>
      </>
    );
  }

  return (
    <>
      <Seo 
        title="Preview Merged PDF — Free PDF Tools (South Africa)"
        description="Preview your merged PDF in your browser. Download or start a new merge — fast, private, and free in South Africa."
        canonicalPath={`/${locale}/view`}
        noindex={true}
      />
      <Layout
        headerProps={{
          theme,
          onToggleTheme: toggleTheme,
          locale,
          setLocale: () => {},
        }}
      >
      <div className="viewerShell">
        {loading ? (
          <div className="viewerLoading">
            <div className="loadingSpinner"></div>
            <p>Loading PDF...</p>
          </div>
        ) : null}
      </div>

      {/* PDF Modal */}
      {showModal && pdfDocument && (
        <PdfModal 
          pdf={pdfDocument} 
          fileUrl={fileUrl} 
          onClose={handleCloseModal} 
        />
      )}
      </Layout>
    </>
  );
}
