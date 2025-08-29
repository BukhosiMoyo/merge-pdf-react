// src/pages/Viewer.jsx
import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { useLocale } from "../state/LocaleContext.jsx";
import { FileText as IcFile, Download as IcDownload, RotateCcw as IcRotate } from "lucide-react";

export default function Viewer() {
  const { id, name } = useParams();
  const location = useLocation();
  const { locale } = useLocale();
  
  // Get download URL from navigation state, localStorage, or fallback to query params for backward compatibility
  const downloadUrl = location.state?.downloadUrl || 
    (() => {
      try {
        const stored = localStorage.getItem(`viewer_${id}`);
        return stored ? JSON.parse(stored).downloadUrl : "";
      } catch {
        return "";
      }
    })() || 
    new URLSearchParams(location.search).get("url") || "";
  
  const fileName = location.state?.fileName || 
    (() => {
      try {
        const stored = localStorage.getItem(`viewer_${id}`);
        return stored ? JSON.parse(stored).fileName : decodeURIComponent(name || "merged.pdf");
      } catch {
        return decodeURIComponent(name || "merged.pdf");
      }
    })() || 
    decodeURIComponent(name || "merged.pdf");

  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "light"
  );
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  // Load PDF document
  useEffect(() => {
    if (!downloadUrl) {
      setError("No PDF URL provided");
      setLoading(false);
      return;
    }

    async function loadPDF() {
      try {
        setLoading(true);
        setError(null);
        
        // Load PDF using PDF.js
        const pdf = await window.pdfjsLib.getDocument(downloadUrl).promise;
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError("Failed to load PDF. The file may have expired or been removed.");
      } finally {
        setLoading(false);
      }
    }

    loadPDF();
  }, [downloadUrl]);

  // Render current page
  useEffect(() => {
    if (!pdfDocument || !currentPage) return;

    async function renderPage() {
      try {
        const page = await pdfDocument.getPage(currentPage);
        const canvas = document.getElementById('pdf-canvas');
        if (!canvas) return;

        const viewport = page.getViewport({ scale: 1.5 });
        const context = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error("Error rendering page:", err);
      }
    }

    renderPage();
  }, [pdfDocument, currentPage]);

  // Set page title
  useEffect(() => {
    if (fileName) {
      document.title = `View ${fileName} - Merge PDF`;
    }
  }, [fileName]);

  function handleDownload() {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  }

  function handleMergeAgain() {
    window.open(`/${locale}`, '_blank');
  }

  function handlePreviousPage() {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }

  function handleNextPage() {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }

  if (error) {
    return (
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
            <h2 className="viewerTitle">PDF could not be loaded</h2>
            <p className="viewerSubtext">{error}</p>
            <div className="viewerActions">
              <button className="viewerAction" onClick={handleDownload}>
                <IcDownload size={16} />
                <span>Try downloading</span>
              </button>
              <button className="viewerAction" onClick={handleMergeAgain}>
                <IcRotate size={16} />
                <span>Start new merge</span>
              </button>
            </div>
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
        setLocale: () => {},
      }}
    >
      <div className="viewerShell">
        <div className="viewerHeader">
          <div className="viewerInfo">
            <h1 className="viewerTitle">{fileName}</h1>
            <div className="viewerMeta">
              {totalPages > 0 && (
                <span className="viewerPages">Page {currentPage} of {totalPages}</span>
              )}
            </div>
          </div>
          <div className="viewerControls">
            <button 
              className="viewerControl" 
              onClick={handlePreviousPage}
              disabled={currentPage <= 1}
            >
              ← Previous
            </button>
            <button 
              className="viewerControl" 
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
            >
              Next →
            </button>
            <button className="viewerControl primary" onClick={handleDownload}>
              <IcDownload size={16} />
              Download
            </button>
            <button className="viewerControl" onClick={handleMergeAgain}>
              <IcRotate size={16} />
              Merge again
            </button>
          </div>
        </div>

        <div className="viewerContent">
          {loading ? (
            <div className="viewerLoading">
              <div className="loadingSpinner"></div>
              <p>Loading PDF...</p>
            </div>
          ) : (
            <div className="pdfContainer">
              <canvas id="pdf-canvas" className="pdfCanvas"></canvas>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
