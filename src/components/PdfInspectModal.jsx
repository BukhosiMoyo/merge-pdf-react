// src/components/PdfInspectModal.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { 
  X as IcClose, 
  RotateCcw as IcRotateLeft, 
  RotateCw as IcRotateRight,
  Trash2 as IcDelete,
  FileText as IcFile
} from "lucide-react";

export default function PdfInspectModal({ 
  fileItem, 
  onClose, 
  rotateById, 
  removeById, 
  pageCount, 
  sizeLabel 
}) {
  const containerRef = useRef(null);
  const pagesRef = useRef(null);
  const [pages, setPages] = useState([]);
  const [renderedPages, setRenderedPages] = useState(new Set());
  const [pdfDocument, setPdfDocument] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);

  // Lock body scroll and add modal-open class
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    };
  }, []);

  // Load PDF document
  useEffect(() => {
    if (!fileItem) return;
    
    let mounted = true;
    (async () => {
      try {
        const arrayBuffer = await fileItem.file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        if (mounted) {
          setPdfDocument(pdf);
          const total = pdf.numPages;
          setPages(Array.from({ length: total }, (_, i) => ({ index: i + 1, ready: false })));
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    })();
    
    return () => { mounted = false; };
  }, [fileItem]);

  // Lazy render pages with IntersectionObserver
  useEffect(() => {
    if (!pagesRef.current || !pdfDocument) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (!entry.isIntersecting) return;
        
        const index = Number(entry.target.dataset.index);
        
        try {
          const page = await pdfDocument.getPage(index);
          const scale = 1.2;
          
          // Apply rotation to viewport
          const rotation = fileItem?.rotate || 0;
          const viewport = page.getViewport({ scale, rotation });
          
          const canvas = entry.target.querySelector('canvas');
          if (!canvas) return;
          
          const ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          await page.render({ canvasContext: ctx, viewport }).promise;
          
          setRenderedPages(prev => new Set([...prev, index]));
          entry.target.dataset.rendered = '1';
        } catch (error) {
          console.error('Error rendering page:', error);
        }
      });
    }, { root: pagesRef.current, threshold: 0.1 });

    const pageElements = pagesRef.current.querySelectorAll('.pdfInspectPage');
    pageElements.forEach(el => observer.observe(el));
    
    return () => observer.disconnect();
  }, [pages, pdfDocument, fileItem?.rotate]);

  // Re-render visible pages when rotation changes
  useEffect(() => {
    if (!pagesRef.current || !pdfDocument) return;
    
    const pageElements = pagesRef.current.querySelectorAll('.pdfInspectPage[data-rendered="1"]');
    pageElements.forEach(async (element) => {
      const index = Number(element.dataset.index);
      
      try {
        const page = await pdfDocument.getPage(index);
        const scale = 1.2;
        const rotation = fileItem?.rotate || 0;
        const viewport = page.getViewport({ scale, rotation });
        
        const canvas = element.querySelector('canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (error) {
        console.error('Error re-rendering page:', error);
      }
    });
  }, [fileItem?.rotate, pdfDocument]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'r' || e.key === 'R') {
        if (e.shiftKey) {
          handleRotateLeft();
        } else {
          handleRotateRight();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
      if (e.key === 'Tab') {
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
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => modal.removeEventListener('keydown', handleTabKey);
  }, []);

  const handleRotateLeft = useCallback(() => {
    if (fileItem) {
      rotateById(fileItem.id);
    }
  }, [fileItem, rotateById]);

  const handleRotateRight = useCallback(() => {
    if (fileItem) {
      rotateById(fileItem.id);
    }
  }, [fileItem, rotateById]);

  const handleDelete = useCallback(() => {
    if (fileItem) {
      removeById(fileItem.id);
      onClose();
    }
  }, [fileItem, removeById, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatFileName = (name) => {
    if (name.length <= 30) return name;
    return name.slice(0, 27) + '...';
  };

  if (!fileItem) return null;

  return (
    <div 
      className="pdfInspectModalOverlay" 
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-inspect-title"
    >
      <div className="pdfInspectModal" ref={containerRef}>
        {/* Header */}
        <div className="pdfInspectHeader">
          <div className="pdfInspectHeaderLeft">
            <div className="pdfInspectIcon">
              <IcFile size={20} />
            </div>
            <div className="pdfInspectFileInfo">
              <h2 id="pdf-inspect-title" className="pdfInspectTitle">Preview</h2>
              <div className="pdfInspectFileName" title={fileItem.file.name}>
                {formatFileName(fileItem.file.name)}
              </div>
            </div>
          </div>
          
          <div className="pdfInspectHeaderRight">
            <div className="pdfInspectActions">
              <div className="tooltipHost">
                <button 
                  className="pdfInspectBtn rotateLeft"
                  onClick={handleRotateLeft}
                  onMouseEnter={() => setActiveTooltip('rotateLeft')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  title="Rotate Left (Shift+R)"
                >
                  <IcRotateLeft size={16} />
                </button>
                {activeTooltip === 'rotateLeft' && (
                  <div className="tooltip above">Rotate Left (Shift+R)</div>
                )}
              </div>
              
              <div className="tooltipHost">
                <button 
                  className="pdfInspectBtn rotateRight primary"
                  onClick={handleRotateRight}
                  onMouseEnter={() => setActiveTooltip('rotateRight')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  title="Rotate Right (R)"
                >
                  <IcRotateRight size={16} />
                </button>
                {activeTooltip === 'rotateRight' && (
                  <div className="tooltip above">Rotate Right (R)</div>
                )}
              </div>
              
              <div className="tooltipHost">
                <button 
                  className="pdfInspectBtn delete"
                  onClick={handleDelete}
                  onMouseEnter={() => setActiveTooltip('delete')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  title="Delete (Delete/Backspace)"
                >
                  <IcDelete size={16} />
                </button>
                {activeTooltip === 'delete' && (
                  <div className="tooltip above">Delete (Delete/Backspace)</div>
                )}
              </div>
            </div>
            
            <button 
              className="pdfInspectClose"
              onClick={onClose}
              aria-label="Close modal"
            >
              <IcClose size={20} />
            </button>
          </div>
        </div>

        {/* File Info Badges */}
        <div className="pdfInspectBadges">
          <span className="pdfInspectBadge">PDF</span>
          <span className="pdfInspectBadgeSeparator">•</span>
          <span className="pdfInspectBadge">{sizeLabel}</span>
          <span className="pdfInspectBadgeSeparator">•</span>
          <span className="pdfInspectBadge">
            {pageCount || pages.length || '...'} page{(pageCount || pages.length || 1) === 1 ? '' : 's'}
          </span>
        </div>

        {/* Viewer Body */}
        <div className="pdfInspectBody" ref={pagesRef}>
          {pages.map(page => (
            <div 
              key={page.index} 
              className="pdfInspectPage" 
              data-index={page.index}
                             style={{ 
                 margin: '0 auto 16px', 
                 maxWidth: '100%'
               }}
            >
              <div className="pdfInspectPageSkeleton">
                <canvas />
              </div>
            </div>
          ))}
        </div>

        {/* Delete Confirmation Toast */}
        {showConfirmDelete && (
          <div className="pdfInspectDeleteToast">
            <span>File deleted</span>
          </div>
        )}
      </div>
    </div>
  );
}
