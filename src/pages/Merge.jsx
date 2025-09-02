import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import StatsAndFAQ from "../components/StatsAndFAQ.jsx";
import Seo from "../components/Seo.jsx";
import PdfInspectModal from "../components/PdfInspectModal.jsx";
import { absolutizeApiUrl } from "../utils/urlUtils.js";
import { DndContext, DragOverlay, rectIntersection, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


/* lucide icons */
import {
  Plus,
  ArrowUpDown,
  RotateCcw,
  X as XIcon,
  Trash2,
  Eye,
  FileText,
} from "lucide-react";


const FILES_MAX = 20;
const FILE_MAX_MB = 20;

/** ✅ single source of truth for the API base */
const API = import.meta.env.VITE_API_BASE || "http://localhost:4000";

if (!import.meta.env.VITE_API_BASE) {
  console.warn("VITE_API_BASE not set. Using fallback:", API);
}

// Helper functions
function formatBytes(bytes){
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(2)} KB`;
  return `${(bytes/1024/1024).toFixed(2)} MB`;
}

function formatFileSize(bytes){
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(2)} KB`;
  return `${(bytes/1024/1024).toFixed(2)} MB`;
}

function pluralize(n, word){ return `${n} ${word}${n===1?'':'s'}`; }

// Helper function to open PDF for multi-page viewer
async function openPdfForViewer(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf; // caller will render pages lazily
  } catch (error) {
    console.error('Error opening PDF:', error);
    return null;
  }
}






/* ---------- Sortable PDF Tile Component ---------- */
function SortablePdfTile({ fileItem, setSelectedPdf, pdfThumbnails, pdfPageCounts, rotateById, removeById, setTileRef, isDragging: isDraggingProp }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: fileItem.id,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  console.log('SortablePdfTile render:', { 
    id: fileItem.id, 
    attributes: Object.keys(attributes), 
    listeners: Object.keys(listeners),
    isDragging 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(fileItem.fly && fileItem.flyTo
        ? { transform: `translate(${fileItem.flyTo.dx}px, ${fileItem.flyTo.dy}px) scale(.2)` }
        : null),
  };

  const name = fileItem.file.name || 'document.pdf';
      const displayName = name.length > 40 ? name.slice(0, 40) + '…' : name;

  // detect overflow for name tooltip
  const nameRef = useRef(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    setOverflow(el.scrollWidth > el.clientWidth);
  }, [name]);

  return (
          <div 
        ref={(node) => { setNodeRef(node); setTileRef(fileItem.id, node); }}
        style={style} 
        className={`pdfTile ${isDragging ? 'dragging' : ''} ${fileItem.fly ? 'flyToTrash' : ''}`}
        {...attributes} 
        {...listeners}
      >
            {/* PDF Preview */}
      <div className="pdfPreview" onClick={() => setSelectedPdf(fileItem)}>
        <div className="pdfPreviewInner">
          {pdfThumbnails[fileItem.id] ? (
            <img 
              src={pdfThumbnails[fileItem.id]} 
              alt={`Preview of ${name}`}
              className="pdfThumbnail"
              style={{ transform: `rotate(${fileItem.rotate}deg)` }}
            />
          ) : (
            <div className="pdfPlaceholder">
              <FileText size={44} />
              <span>Loading...</span>
            </div>
          )}
        </div>

        {fileItem.rotate !== 0 && (
          <div className="rotationIndicator">
            {fileItem.rotate}°
          </div>
        )}
        
        {/* Tile Actions - Top Right */}
        <div className={`tileActions ${isDragging ? 'hiddenDuringDrag' : ''}`}>
          <div className="tooltipHost">
            <button 
              className="tileActionBtn rotateBtn"
              onClick={(e) => { e.stopPropagation(); rotateById(fileItem.id); }}
            >
              <RotateCcw size={16} />
            </button>
            <div className="tooltip above">Rotate</div>
          </div>
          <div className="tooltipHost">
            <button 
              className="tileActionBtn deleteBtn"
              onClick={(e) => { e.stopPropagation(); removeById(fileItem.id); }}
            >
              <XIcon size={16} />
            </button>
            <div className="tooltip above">Remove this file</div>
          </div>
        </div>

        {/* File Info Tooltip - Above tile */}
        <div className="pdfInfoTooltip">
          {`${formatBytes(fileItem.file.size)} - ${
            pdfPageCounts[fileItem.id] ? `${pdfPageCounts[fileItem.id]} page${pdfPageCounts[fileItem.id]===1?'':'s'}` : '… pages'
          }`}
        </div>
      </div>
      
      {/* PDF Name */}
      <div ref={nameRef} className="pdfName" data-overflow={overflow ? 'true' : 'false'} title="">
        {displayName}
      </div>
      {/* Custom tooltip only if overflow */}
      {overflow && <div className="pdfNameTooltip">{name}</div>}
    </div>
  );
}



/* ---------- Bin/Undo ---------- */
function BinOverlay({ count, onUndo, onUndoAll }) {
  if (!count) return null;
  return (
    <div className="undoToast">
      <button onClick={onUndo}>↩︎ Undo</button>
      {count > 1 && (
        <button onClick={onUndoAll} style={{ background: "#111", marginLeft: 6 }}>
          ↩︎ Undo all
        </button>
      )}
    </div>
  );
}

/* ---------- Page ---------- */
export default function Merge() {
  const nav = useNavigate();

  const [files, setFiles] = useState([]); // [{id,file,originalIndex,rotate,fly:false}]
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState("light");
  const [locale, setLocale] = useState("en");

  const [sortDir, setSortDir] = useState("az");
  const [dropActive, setDropActive] = useState(false);
  const [trash, setTrash] = useState([]); // [{id,file,originalIndex}]
  const [showTips, setShowTips] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState(null); // For PDF viewer modal
  const [pdfThumbnails, setPdfThumbnails] = useState({}); // Store PDF thumbnails
  const [pdfPageCounts, setPdfPageCounts] = useState({}); // Store PDF page counts
  const [activeId, setActiveId] = useState(null);       // For DnD placeholder
  const [activeItem, setActiveItem] = useState(null);   // For DragOverlay preview
  const [isDragging, setIsDragging] = useState(false);

  const [showTrashDock, setShowTrashDock] = useState(false);


  const inputRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Tile refs for fly animation
  const tileRefs = useRef(new Map());
  const setTileRef = (id, node) => {
    if (node) tileRefs.current.set(id, node);
    else tileRefs.current.delete(id);
  };

  const trashDockRef = useRef(null);

  // Drag and Drop sensors - improved for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Small distance threshold for reliable activation
        delay: 250, // Small delay for mobile to prevent accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  console.log('Sensors configured:', sensors);

  // Load PDF.js for thumbnail generation
  useEffect(() => {
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }
  }, []);

  // theme init
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isNight = () => {
      const h = new Date().getHours();
      return h >= 19 || h < 7;
    };
    const initial = saved || (isNight() ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }



  // intake files
  function isPdf(f) {
    return f?.type === "application/pdf" || /\.pdf$/i.test(f?.name || "");
  }

  // Generate PDF thumbnail and get page count
  async function generateThumbnail(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = window.pdfjsLib;
      
      if (!pdfjsLib) {
        console.warn('PDF.js not loaded, using fallback thumbnail');
        return { thumbnail: null, pageCount: 0 };
      }

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageCount = pdf.numPages;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.5 });
      
      const canvas = document.createElement('canvas');
      let context;
      try {
        context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Could not get 2D context from canvas');
        }
      } catch (error) {
        console.warn('Canvas context error:', error);
        return { thumbnail: null, pageCount };
      }
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
      return { thumbnail, pageCount };
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error);
      return { thumbnail: null, pageCount: 0 };
    }
  }

  async function acceptFiles(fileList) {
    const selected = Array.from(fileList || []).filter(isPdf);
    const accepted = [];
    let totalAfter = files.length;
    for (const f of selected) {
      if (f.size / 1024 / 1024 > FILE_MAX_MB) continue;
      if (totalAfter >= FILES_MAX) break;
      accepted.push(f);
      totalAfter++;
    }
    if (!accepted.length) return;

    const added = accepted.map((f, i) => ({
      id: rid(),
      file: f,
      originalIndex: files.length + i,
      rotate: 0,
      fly: false,
    }));
    
    // Generate thumbnails and get page counts for new files
    for (const item of added) {
      const result = await generateThumbnail(item.file);
      if (result.thumbnail) {
        setPdfThumbnails(prev => ({
          ...prev,
          [item.id]: result.thumbnail
        }));
      }
      if (result.pageCount > 0) {
        setPdfPageCounts(prev => ({
          ...prev,
          [item.id]: result.pageCount
        }));
      }
    }
    
    setFiles((prev) => [...prev, ...added]);
  }
  function onPick(e) {
    acceptFiles(e.target.files);
    e.target.value = "";
  }

  // dropzone
  function onDragOver(e) {
    // Only activate if files are being dragged
    if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
    e.preventDefault();
    setDropActive(true);
  }
  function onDragLeave(e) {
    if (e.currentTarget === e.target) setDropActive(false);
  }
  function onDrop(e) {
    e.preventDefault();
    setDropActive(false);
    if (e.dataTransfer?.files?.length) {
      acceptFiles(e.dataTransfer.files);
      // Force dropActive to false as final safety
      setDropActive(false);
    }
  }



  // rotation
  function rotateById(id) {
    setFiles((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, rotate: (x.rotate + 90) % 360 } : x
      )
    );
  }



  // delete / undo
  function removeById(id) {
    // guard: already flying or already removed
    const victim = files.find(x => x.id === id);
    if (!victim || victim.fly) return;

    const tileEl = tileRefs.current.get(id);
    const binEl = trashDockRef.current;

    // ensure dock is visible for the animation
    setShowTrashDock(true);

    if (!tileEl || !binEl) {
      setFiles(prev => prev.map(x => x.id === id ? ({ ...x, fly: true }) : x));
      setTimeout(() => {
        setFiles(prev => prev.filter(x => x.id !== id));
        setTrash(prev => [...prev, { ...victim }]);
        setShowTrashDock(false);
      }, 460);
      return;
    }

    const tileRect = tileEl.getBoundingClientRect();
    const binRect  = binEl.getBoundingClientRect();
    const dx = (binRect.left + binRect.width/2) - (tileRect.left + tileRect.width/2);
    const dy = (binRect.top  + binRect.height/2) - (tileRect.top  + tileRect.height/2);

    // trigger fly
    setFiles(prev => prev.map(x => x.id === id ? ({ ...x, fly: true, flyTo: { dx, dy } }) : x));

    setTimeout(() => {
      setFiles(prev => prev.filter(x => x.id !== id));
      setTrash(prev => [...prev, { ...victim }]);
      // hide the dock shortly after the animation
      setTimeout(() => setShowTrashDock(false), 150);
    }, 460);
  }
  function restoreOne() {
    setTrash((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setFiles((f) => [
        ...f,
        { id: last.id, file: last.file, originalIndex: last.originalIndex, rotate: 0, fly: false },
      ]);
      return prev.slice(0, -1);
    });
  }
  function restoreAll() {
    setTrash((prev) => {
      if (!prev.length) return prev;

      // restore files
      setFiles((f) => [
        ...f,
        ...prev.map((x) => ({
          id: x.id,
          file: x.file,
          originalIndex: x.originalIndex,
          rotate: 0,
          fly: false,
        })),
      ]);

      return [];
    });
  }

  // sorting
  function toggleSort() {
    const next = sortDir === "az" ? "za" : "az";
    setSortDir(next);
    setFiles((prev) => {
      const sorted = [...prev].sort((a, b) =>
        a.file.name.localeCompare(b.file.name, undefined, { numeric: true })
      );
      return next === "az" ? sorted : sorted.reverse();
    });
  }
  function restoreOriginal() {
    setFiles((prev) => [...prev].sort((a, b) => a.originalIndex - b.originalIndex));
  }

  // merge
  const [progress, setProgress] = useState({ pct: 0, speed: "" });
  async function handleMerge() {
    if (files.length < 2 || busy) return;
    if (!API) {
      alert("VITE_API_BASE is not set. Please set it to https://api.compresspdf.co.za");
      return;
    }
    setBusy(true);
    
    // Safety timeout to prevent stuck busy state
    const safetyTimeout = setTimeout(() => {
      console.log('Safety timeout: resetting busy state');
      setBusy(false);
    }, 30000); // 30 seconds timeout

    const fd = new FormData();
    files.forEach(({ file }) => fd.append("files[]", file, file.name));

    const xhr = new XMLHttpRequest();
    let lastLoaded = 0,
      lastT = performance.now();

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      const now = performance.now();
      const dt = (now - lastT) / 1000;
      const dB = e.loaded - lastLoaded;
      let speed = "";
      if (dt > 0) {
        const rate = dB / dt;
        speed =
          rate > 1024 * 1024
            ? (rate / 1024 / 1024).toFixed(1) + " MB/s"
            : Math.max(1, Math.round(rate / 1024)) + " KB/s";
      }
      setProgress({ pct, speed });
      lastLoaded = e.loaded;
      lastT = now;
    };

    xhr.onerror = () => {
      clearTimeout(safetyTimeout);
      alert("Network error while contacting the merge API.");
      setBusy(false);
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      const status = xhr.status;
      const ct = (xhr.getResponseHeader("content-type") || "").toLowerCase();
      const isJSON = ct.includes("application/json");
      let data = null;
      if (isJSON) {
        try {
          data = JSON.parse(xhr.responseText || "{}");
        } catch {}
      }
      if (status >= 200 && status < 300) {
        clearTimeout(safetyTimeout);
        const url = data?.output?.download_url;
        if (!url) {
          alert("Server did not include a download URL.");
          setBusy(false);
          return;
        }
        
        // ✅ Absolutize the download URL to prevent index.html downloads
        const absoluteDownloadUrl = absolutizeApiUrl(url);
        
        // Generate a unique ID for the download
        const downloadId = rid(12);
        
        // Calculate expiry time (1 hour from now)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        
        // Use friendly filename for URL and download
        const friendlyFilename = "merge-pdf-file.pdf";
        
        nav(`/${locale}/download/${downloadId}/${friendlyFilename}`, {
          replace: true,
          state: { 
            downloadUrl: absoluteDownloadUrl, 
            fileName: "Merge PDF File.pdf",
            expiresAt: expiresAt
          }
        });
        return;
      }
      let msg =
        data?.error?.message ||
        (isJSON ? "Merge failed." : "Merge failed — server returned HTML (check URL/CORS).");
      if (status === 404) msg += " (404 Not Found — check VITE_API_BASE and /v1/pdf/merge)";
      if (status === 413) msg += " (413 Payload Too Large — server upload limit too low)";
      if (status === 415) msg += " (415 Unsupported Media Type — multipart/form-data issue)";
      if (status === 422) msg += " (422 — fewer than 2 PDFs or invalid files)";
      clearTimeout(safetyTimeout);
      alert(msg);
      setBusy(false);
    };
    
    console.log("POST →", import.meta.env.VITE_API_BASE + "/v1/pdf/merge");

    xhr.open("POST", `${API}/v1/pdf/merge`);
    xhr.withCredentials = true; // ✅ required for our CORS config
    xhr.send(fd);
  }

  const hasFiles = files.length > 0;

  // Drag and Drop handlers
  function handleDragStart(event) {
    const id = event.active.id;
    setActiveId(id);
    setActiveItem(files.find(f => f.id === id) || null);
    setIsDragging(true);
  }

  function handleDragOver(event) {
    // Let dnd-kit handle the spacing naturally
    // No manual placeholder logic needed
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    setActiveItem(null);
    setIsDragging(false);
    
    if (!over || active.id === over.id) return;
    
    setFiles((items) => {
      const oldIndex = items.findIndex((it) => it.id === active.id);
      const newIndex = items.findIndex((it) => it.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  // ... existing code ...

  return (
    <>
      <Seo 
        title="Merge PDF Online (Free, Secure) — South Africa"
        description="Combine multiple PDFs into one fast, secure file. Free PDF merger for South Africa. No signup, mobile friendly, privacy-first."
        canonicalPath={`/${locale}`}
      />
      <Layout
        headerProps={{
          theme,
          onToggleTheme: toggleTheme,
          locale,
          setLocale,
          hideStats: hasFiles, // Hide Stats button when files are present (step 2)
        }}
        hideFooter={hasFiles} // Hide footer when files are present (PDF editing step)
      >
      <div
        className={`appShell ${!hasFiles ? "appShell--no-sidebar" : ""} ${isDragging ? "dragging" : ""}`}
        style={{ height: "var(--app-height, auto)" }}
      >


          <div
            ref={canvasRef}
            className={`canvasArea dropzone ${dropActive ? "dropActive" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
           {!hasFiles ? (
             <>
               <section className="zeroState">
                 <h1 className="titleClamp">Merge PDF files</h1>
                 <p className="subtleClamp">
                   Combine PDFs in the order you want. Drag &amp; drop or click the big button.
                 </p>
                 <button className="ctaHuge pulseBorderGreen" onClick={() => inputRef.current?.click()}>
                   <span className="btnLabel">Select PDF files</span>
                   <span className="plusIcon">
                     <Plus size={28} />
                   </span>
                 </button>
                 <p className="dropHint">or drop PDFs here</p>
                 
                 <input
                   ref={inputRef}
                   type="file"
                   accept="application/pdf"
                   multiple
                   onChange={onPick}
                   hidden
                 />
               </section>

               {/* Counter + FAQs on the empty step */}
               <StatsAndFAQ />
             </>
           ) : (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={onPick}
                  hidden
                />
              </>
            )}
          </div>
 
                                   

                                                                                   {/* Floating Action Buttons - Desktop Center Top, Mobile Right Side */}
            {hasFiles && (
              <div className="floatingActions">
                {/* Add Files Button - FIRST (most important) */}
                <div className="tooltipHost">
                  <button 
                    className="fabButton fabAdd" 
                    onClick={() => inputRef.current?.click()}
                    style={{ color: 'white' }}
                  >
                    <Plus size={22} style={{ color: 'white', opacity: 1, visibility: 'visible' }} />
                  </button>
                  {/* File Count Bubble - OUTSIDE the button */}
                  <div className="fileCountBubble">
                    {files.length}
                  </div>
                  <div className="tooltip bottom">Add more files</div>
                </div>

                {/* Sort Button */}
                <div className="tooltipHost">
                  <button 
                    className="fabButton fabSort" 
                    onClick={toggleSort}
                    style={{ color: 'white' }}
                  >
                    <ArrowUpDown size={22} style={{ color: 'white', opacity: 1, visibility: 'visible' }} />
                  </button>
                  <div className="tooltip bottom">Sort A–Z / Z–A</div>
                </div>

                {/* Restore Original Button */}
                <div className="tooltipHost">
                  <button 
                    className="fabButton fabRestore" 
                    onClick={restoreOriginal}
                    style={{ color: 'white' }}
                  >
                    <RotateCcw size={22} style={{ color: 'white', opacity: 1, visibility: 'visible' }} />
                  </button>
                  <div className="tooltip bottom">Restore original order</div>
                </div>

                {/* Tips/Info Button - LAST (least important) */}
                <div className="tooltipHost">
                  <button 
                    className="fabButton fabInfo" 
                    onClick={() => setShowTips(!showTips)}
                    style={{ color: 'white' }}
                  >
                    <span className="fabIcon" style={{ color: 'white', opacity: 1, visibility: 'visible', fontSize: '22px', fontWeight: 'bold' }}>i</span>
                  </button>
                  <div className="tooltip bottom">Tips</div>
                </div>
              </div>
            )}

          {/* Spacer to push tiles below fixed action buttons */}
          {hasFiles && <div className="actionsSpacer" aria-hidden />}

          {/* PDF Tiles Grid with Drag and Drop */}
          {hasFiles && (
            <div className="pdfTilesContainer">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
              >
                <SortableContext items={files.map(f => f.id)} strategy={rectSortingStrategy}>
                  <div className="pdfTilesGrid">
                    {files.map((fileItem, index) => (
                      <SortablePdfTile
                        key={fileItem.id}
                        fileItem={fileItem}
                        setSelectedPdf={setSelectedPdf}
                        pdfThumbnails={pdfThumbnails}
                        pdfPageCounts={pdfPageCounts}
                        rotateById={rotateById}
                        removeById={removeById}
                        setTileRef={setTileRef}
                        isDragging={isDragging && activeId === fileItem.id} // Show dragging state for the active tile
                      />
                    ))}
                    
                  </div>
                </SortableContext>
                <DragOverlay dropAnimation={{
                  duration: 180,
                  easing: 'cubic-bezier(0.2,0.8,0.2,1)'
                }}>
                  {activeItem ? (
                    <div className="pdfTile draggingClone">
                      <div className="pdfPreview"><div className="pdfPreviewInner">
                        {pdfThumbnails[activeItem.id]
                          ? <img className="pdfThumbnail" style={{transform:`rotate(${activeItem.rotate}deg)`}} src={pdfThumbnails[activeItem.id]} />
                          : <div className="pdfPlaceholder">Preview</div>}
                      </div></div>
                      {/* Hide filename in drag clone for cleaner look */}
                    </div>
                  ) : null}
                </DragOverlay>
        

      </DndContext>
            </div>
          )}



          {/* Trash Dock (fixed) */}
          {hasFiles && showTrashDock && (
            <div className="trashDock" ref={trashDockRef} title="Deleted files bin">
              <Trash2 size={20} />
            </div>
          )}

          {/* Mobile Merge Button - Always Visible */}
          {hasFiles && (
            <div className="mobileMergeButton">
              <button
                className={`ctaMerge mobileCtaMerge ${files.length >= 2 && !busy ? "pulseBorderGreen" : ""}`}
                disabled={busy || files.length < 2}
                onClick={handleMerge}
              >
                <span>Merge PDF</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>
              </button>
            </div>
          )}

          {/* Tips Overlay */}
          {showTips && (
            <div className="tipsOverlay" onClick={() => setShowTips(false)}>
              <div className="tipsCard" onClick={(e) => e.stopPropagation()}>
                <div className="tipsHeader">
                  <h3>💡 Quick Tips</h3>
                  <button className="tipsClose" onClick={() => setShowTips(false)}>×</button>
                </div>
                <div className="tipsContent">
                  <div className="tipItem">
                    <strong>📁 Add Files:</strong> Click the + button or drag & drop PDFs
                  </div>
                  <div className="tipItem">
                    <strong>🔄 Sort:</strong> Arrange files alphabetically A→Z or Z→A
                  </div>
                  <div className="tipItem">
                    <strong>↩️ Restore:</strong> Return to original file order
                  </div>
                  <div className="tipItem">
                    <strong>🔀 Merge:</strong> Combine 2+ PDFs into one file
                  </div>
                  <div className="tipItem">
                    <strong>🗑️ Remove:</strong> Swipe left on files to delete
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PDF Inspect Modal */}
          {selectedPdf && (
            <PdfInspectModal 
              fileItem={selectedPdf}
              onClose={() => setSelectedPdf(null)}
              rotateById={rotateById}
              removeById={removeById}
              pageCount={pdfPageCounts[selectedPdf.id]}
              sizeLabel={formatBytes(selectedPdf.file.size)}
            />
          )}

          {/* Drag overlay */}
          {dropActive && (
            <div
              className="dropOverlay"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onDragLeave={() => setDropActive(false)}
            >
              <div className="dropOverlayInner">
                <div className="bigCatch">Drop it like it's smart 🧠</div>
                <div className="smallCatch">Release to add your PDFs</div>
              </div>
            </div>
          )}

          {/* Merge progress */}
          {busy && (
            <div className="loadingOverlay">
              <div className="loadingCard">
                <div className="ring">
                  <div className="ringInner" style={{ "--pct": `${progress.pct || 0}%` }} />
                  <div className="ringText">{progress.pct || 0}%</div>
                </div>
                <div className="mergeMsg">Merging PDFs…</div>
                <div className="mergeSpeed">{progress.speed}</div>
              </div>
            </div>
          )}

          {/* Bin/Undo */}
          <BinOverlay count={trash.length} onUndo={restoreOne} onUndoAll={restoreAll} />
          
          {/* Debug: Reset busy state (only in development) */}
          {import.meta.env.DEV && busy && (
            <div style={{
              position: 'fixed',
              top: '10px',
              right: '10px',
              zIndex: 999999,
              background: 'red',
              color: 'white',
              padding: '10px',
              borderRadius: '5px',
              cursor: 'pointer'
            }} onClick={() => setBusy(false)}>
              Reset Busy State (Debug)
            </div>
          )}
        </div>

        {/* Drag overlay */}
       {dropActive && (
         <div
           className="dropOverlay"
           onDragOver={(e) => e.preventDefault()}
           onDrop={onDrop}
           onDragLeave={() => setDropActive(false)}
         >
           <div className="dropOverlayInner">
             <div className="bigCatch">Drop it like it’s smart 🧠</div>
             <div className="smallCatch">Release to add your PDFs</div>
           </div>
         </div>
       )}
 
       {/* Merge progress */}
       {busy && (
         <div className="loadingOverlay">
           <div className="loadingCard">
             <div className="ring">
               <div className="ringInner" style={{ "--pct": `${progress.pct || 0}%` }} />
               <div className="ringText">{progress.pct || 0}%</div>
             </div>
             <div className="mergeMsg">Merging PDFs…</div>
             <div className="mergeSpeed">{progress.speed}</div>
           </div>
         </div>
       )}
 
                         {/* Bin/Undo */}
          <BinOverlay count={trash.length} onUndo={restoreOne} onUndoAll={restoreAll} />
          
          {/* Debug: Reset busy state (only in development) */}
          {import.meta.env.DEV && busy && (
            <div style={{
              position: 'fixed',
              top: '10px',
              right: '10px',
              zIndex: 999999,
              background: 'red',
              color: 'white',
              padding: '10px',
              borderRadius: '5px',
              cursor: 'pointer'
            }} onClick={() => setBusy(false)}>
              Reset Busy State (Debug)
            </div>
          )}

        
      </Layout>
    </>
  );
}

/* util */
function rid(n = 8) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
