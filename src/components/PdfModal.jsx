// src/components/PdfModal.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "../state/LocaleContext.jsx";
import { 
  Download as IcDownload, 
  RotateCcw as IcRotate, 
  X as IcClose,
  Minus as IcMinus,
  Plus as IcPlus,
  Maximize as IcMaximize,
  Grid3X3 as IcThumbnails
} from "lucide-react";

const FRIENDLY_FILENAME = "Merge PDF File.pdf";

// Zoom levels and steps
const ZOOM_STEPS = [0.625, 0.75, 1.0, 1.25, 1.5, 2.0];
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;

export default function PdfModal({ pdf, fileUrl, onClose }) {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const containerRef = useRef(null);
  const bodyRef = useRef(null);
  const thumbnailsRef = useRef(null);
  
  const [pages, setPages] = useState([]);
  const [renderedPages, setRenderedPages] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fitScale, setFitScale] = useState(1.0);
  const [isFitMode, setIsFitMode] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [thumbnails, setThumbnails] = useState({});

  // Lock body scroll when modal opens
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Initialize pages array and calculate fit scale
  useEffect(() => {
    if (!pdf) return;
    const total = pdf.numPages;
    setPages(Array.from({ length: total }, (_, i) => ({ index: i + 1, ready: false })));
    
    // Calculate initial fit scale
    calculateFitScale();
  }, [pdf]);

  // Calculate fit scale based on container width
  const calculateFitScale = useCallback(async () => {
    if (!pdf || !bodyRef.current) return;
    
    try {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = bodyRef.current.clientWidth - 40; // Account for padding
      const newFitScale = Math.min(containerWidth / viewport.width, 1.5);
      setFitScale(newFitScale);
      
      if (isFitMode) {
        setScale(newFitScale);
      }
    } catch (error) {
      console.error('Error calculating fit scale:', error);
    }
  }, [pdf, isFitMode]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      calculateFitScale();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateFitScale]);

  // Render pages with intersection observer
  useEffect(() => {
    if (!bodyRef.current || !pdf) return;
    
    const io = new IntersectionObserver((entries) => {
      entries.forEach(async (e) => {
        if (!e.isIntersecting || renderedPages.has(Number(e.target.dataset.index))) return;
        
        const index = Number(e.target.dataset.index);
        try {
          const page = await pdf.getPage(index);
          const currentScale = isFitMode ? fitScale : scale;
          const scaledViewport = page.getViewport({ scale: currentScale });
          
          const canvas = e.target.querySelector('canvas');
          if (!canvas) return;
          
          const ctx = canvas.getContext('2d');
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          
          await page.render({
            canvasContext: ctx,
            viewport: scaledViewport
          }).promise;
          
          setRenderedPages(prev => new Set([...prev, index]));
          e.target.dataset.rendered = '1';
        } catch (error) {
          console.error('Error rendering page:', error);
        }
      });
    }, { root: bodyRef.current, threshold: 0.1 });

    const nodes = bodyRef.current.querySelectorAll('.pdf-page');
    nodes.forEach(n => io.observe(n));
    
    return () => io.disconnect();
  }, [pdf, renderedPages, scale, fitScale, isFitMode]);

  // Track current page with intersection observer
  useEffect(() => {
    if (!bodyRef.current) return;
    
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const pageNum = Number(entry.target.dataset.index);
          setCurrentPage(pageNum);
        }
      });
    }, { 
      root: bodyRef.current, 
      threshold: 0.5,
      rootMargin: '-20% 0px -20% 0px'
    });

    const nodes = bodyRef.current.querySelectorAll('.pdf-page');
    nodes.forEach(n => io.observe(n));
    
    return () => io.disconnect();
  }, [pages]);

  // Generate thumbnails for desktop
  useEffect(() => {
    if (!showThumbnails || !pdf || !thumbnailsRef.current) return;
    
    const generateThumbnails = async () => {
      const newThumbnails = {};
      
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.2 }); // Small scale for thumbnails
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          await page.render({
            canvasContext: ctx,
            viewport: viewport
          }).promise;
          
          newThumbnails[i] = canvas.toDataURL('image/jpeg', 0.8);
        } catch (error) {
          console.error(`Error generating thumbnail for page ${i}:`, error);
        }
      }
      
      setThumbnails(newThumbnails);
    };
    
    generateThumbnails();
  }, [showThumbnails, pdf]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape key - close modal
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      
      // Zoom shortcuts (Ctrl/Cmd + Plus/Minus/0)
      if ((e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        
        if (e.key === '+' || e.key === '=') {
          handleZoomIn();
        } else if (e.key === '-') {
          handleZoomOut();
        } else if (e.key === '0') {
          handleFitToWidth();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setIsFitMode(false);
    const currentIndex = ZOOM_STEPS.findIndex(step => step >= scale);
    const nextIndex = Math.min(currentIndex + 1, ZOOM_STEPS.length - 1);
    const newScale = Math.min(ZOOM_STEPS[nextIndex], ZOOM_MAX);
    setScale(newScale);
    setRenderedPages(new Set()); // Clear rendered pages to re-render with new scale
  }, [scale]);

  const handleZoomOut = useCallback(() => {
    setIsFitMode(false);
    const currentIndex = ZOOM_STEPS.findIndex(step => step >= scale);
    const prevIndex = Math.max(currentIndex - 1, 0);
    const newScale = Math.max(ZOOM_STEPS[prevIndex], ZOOM_MIN);
    setScale(newScale);
    setRenderedPages(new Set()); // Clear rendered pages to re-render with new scale
  }, [scale]);

  const handleFitToWidth = useCallback(() => {
    setIsFitMode(true);
    setScale(fitScale);
    setRenderedPages(new Set()); // Clear rendered pages to re-render with new scale
  }, [fitScale]);

  const handleZoomTo100 = useCallback(() => {
    setIsFitMode(false);
    setScale(1.0);
    setRenderedPages(new Set()); // Clear rendered pages to re-render with new scale
  }, []);

  // Jump to page
  const handleJumpToPage = useCallback((pageNum) => {
    const pageElement = bodyRef.current?.querySelector(`[data-index="${pageNum}"]`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Focus trap
  useEffect(() => {
    const modal = containerRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    firstElement?.focus();
    
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, []);

  const handleDownload = useCallback(() => {
    if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = FRIENDLY_FILENAME;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [fileUrl]);

  const handleStartNewMerge = useCallback(() => {
    navigate(`/${locale}`);
  }, [navigate, locale]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const toggleThumbnails = useCallback(() => {
    setShowThumbnails(prev => !prev);
  }, []);

  if (!pdf) return null;

  const currentScalePercent = Math.round((isFitMode ? fitScale : scale) * 100);

  return (
    <div 
      className="pdfModalOverlay" 
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-modal-title"
    >
      <div className={`pdfModal ${showThumbnails ? 'withThumbnails' : ''}`} ref={containerRef}>
        {/* Thumbnails Rail (Desktop only) */}
        {showThumbnails && (
          <div className="pdfThumbnailsRail" ref={thumbnailsRef}>
            <div className="thumbnailsHeader">
              <h3>Pages</h3>
              <button className="thumbnailsClose" onClick={toggleThumbnails}>
                <IcClose size={16} />
              </button>
            </div>
            <div className="thumbnailsList">
              {pages.map(page => (
                <button
                  key={page.index}
                  className={`thumbnailItem ${currentPage === page.index ? 'active' : ''}`}
                  onClick={() => handleJumpToPage(page.index)}
                >
                  <div className="thumbnailCanvas">
                    {thumbnails[page.index] ? (
                      <img src={thumbnails[page.index]} alt={`Page ${page.index}`} />
                    ) : (
                      <div className="thumbnailSkeleton">Loading...</div>
                    )}
                  </div>
                  <span className="thumbnailNumber">{page.index}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="pdfModalContent">
          {/* Header */}
          <div className="pdfModalHeader">
            <div className="pdfModalHeaderLeft">
              <h2 id="pdf-modal-title" className="pdfModalTitle">Merged PDF Preview</h2>
              <div className="pageIndicator">
                Page {currentPage} / {pdf.numPages}
              </div>
            </div>
            
            <div className="pdfModalHeaderRight">
              {/* Zoom Controls */}
              <div className="zoomControls">
                <button className="zoomBtn" onClick={handleZoomOut} title="Zoom out (Ctrl/Cmd -)">
                  <IcMinus size={16} />
                </button>
                <button 
                  className={`zoomBtn ${isFitMode ? 'active' : ''}`} 
                  onClick={handleFitToWidth}
                  title="Fit to width (Ctrl/Cmd 0)"
                >
                  <IcMaximize size={16} />
                </button>
                <button className="zoomBtn" onClick={handleZoomTo100} title="100% zoom">
                  100%
                </button>
                <button className="zoomBtn" onClick={handleZoomIn} title="Zoom in (Ctrl/Cmd +)">
                  <IcPlus size={16} />
                </button>
                <span className="zoomLevel">{currentScalePercent}%</span>
              </div>

              {/* Thumbnails Toggle (Desktop only) */}
              <button 
                className={`pdfModalBtn ${showThumbnails ? 'active' : ''}`}
                onClick={toggleThumbnails}
                title="Toggle thumbnails"
              >
                <IcThumbnails size={16} />
                Thumbnails
              </button>

              {/* Action Buttons */}
              <button className="pdfModalBtn primary" onClick={handleDownload}>
                <IcDownload size={16} />
                Download
              </button>
              <button className="pdfModalBtn" onClick={handleStartNewMerge}>
                <IcRotate size={16} />
                Start new merge
              </button>
              <button className="pdfModalBtn close" onClick={onClose} aria-label="Close modal">
                <IcClose size={16} />
              </button>
            </div>
          </div>

          {/* Body - PDF Viewer */}
          <div className="pdfModalBody" ref={bodyRef}>
            {pages.map(page => (
              <div 
                key={page.index} 
                className="pdf-page" 
                data-index={page.index}
                style={{ margin: '0 auto 16px', maxWidth: '100%' }}
              >
                <div className="pdfPageSkeleton">
                  <canvas />
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="pdfModalFooter">
            <p>Use the Download button above to save this file. Keyboard shortcuts: Ctrl/Cmd + Plus/Minus to zoom, Ctrl/Cmd + 0 to fit.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
