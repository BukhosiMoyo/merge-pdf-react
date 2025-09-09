import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import StatsAndFAQ from "../components/StatsAndFAQ.jsx";
import Seo from "../components/Seo.jsx";
import PdfInspectModal from "../components/PdfInspectModal.jsx";
import { absolutizeApiUrl } from "../utils/urlUtils.js";
import { DndContext, DragOverlay, rectIntersection, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
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
  Unlock,
  FileText,
} from "lucide-react";


const FILES_MAX = 20;
const FILE_MAX_MB = 20;
const TOTAL_MAX_MB = 100;
const PAGES_MAX = 1000;

// Animation tokens (tweakable)
const ANIM = {
  crumpleMs: 220,
  throwMs: 520,
  staggerMs: 90,
  binPulseMs: 220,
};

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

// Probe if a PDF can be opened with pdf.js (detects encrypted/corrupt)
async function probePdfReadable(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) return { ok: true };
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    // Touch first page to ensure renderable
    await pdf.getPage(1);
    return { ok: true };
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase();
    const code = msg.includes('password') || msg.includes('encrypted') ? 'password' : 'invalid';
    return { ok: false, code };
  }
}






/* ---------- Sortable PDF Tile Component ---------- */
function SortablePdfTile({ fileItem, setSelectedPdf, pdfThumbnails, pdfPageCounts, rotateById, removeById, setTileRef, isDragging: isDraggingProp, passwordsById, setPasswordForId }) {
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

  if (import.meta.env.DEV && false) console.debug('SortablePdfTile render:', { 
    id: fileItem.id, 
    attributes: Object.keys(attributes), 
    listeners: Object.keys(listeners),
    isDragging 
  });

  const isLocked = Boolean(fileItem.locked) && !passwordsById[fileItem.id];
  const deletionVars = fileItem.fly && fileItem.flyTo
    ? { '--dx': `${fileItem.flyTo.dx}px`, '--dy': `${fileItem.flyTo.dy}px` }
    : {};
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isLocked ? { border: '2px solid #e11d48' } : null),
    ...deletionVars,
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
        className={`pdfTile ${isDragging ? 'dragging' : ''} ${fileItem.fly ? 'isDeleting' : ''}`}
        {...attributes} 
        {...listeners}
      >
            {/* PDF Preview */}
      <div className="pdfPreview" onClick={() => setSelectedPdf(fileItem)}>
        <div className="pdfPreviewInner">
          {isLocked ? (
            <div className="pdfPlaceholder" style={{
              display:'flex', alignItems:'center', justifyContent:'center',
              height:'100%', width:'100%',
              color:'#e11d48', fontWeight:700, letterSpacing:'1px'
            }}>
              <span>LOCKED</span>
            </div>
          ) : (
            pdfThumbnails[fileItem.id] ? (
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
            )
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
          {isLocked && (
            <div className="tooltipHost">
              <button 
                className="tileActionBtn"
                style={{ background:'#e11d48', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28 }}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const pw = window.prompt(`Enter password for ${name}`) || '';
                  if (pw) setPasswordForId(fileItem.id, pw);
                }}
              >
                <Unlock size={14} />
              </button>
              <div className="tooltip above">Provide password</div>
            </div>
          )}
        </div>

        {/* File Info Tooltip - Above tile */}
        <div className="pdfInfoTooltip">
          {`${formatBytes(fileItem.file.size)} - ${
            pdfPageCounts[fileItem.id] ? `${pdfPageCounts[fileItem.id]} page${pdfPageCounts[fileItem.id]===1?'':'s'}` : '… pages'
          }`}
        </div>
      </div>
      
      {/* PDF Meta Row: name (left, ellipsized) + size (right, fixed) */}
      <div className="pdfMetaRow">
        <div className="pdfNameWrap">
          <div ref={nameRef} className="pdfName" data-overflow={overflow ? 'true' : 'false'} title="">
            {displayName}
          </div>
          {overflow && <div className="pdfNameTooltip">{name}</div>}
        </div>
        <div className="pdfPill" aria-hidden>PDF</div>
      </div>
    </div>
  );
}



/* ---------- Bin/Undo ---------- */
function BinOverlay({ count, onUndo, onUndoAll, secondsLeft }) {
  if (!count) return null;
  const TTL = 8;
  const pct = Math.max(0, Math.min(100, Math.round((secondsLeft / TTL) * 100)));
  return (
    <div className="binCluster" role="status" aria-live="polite">
      <div className="binBadge" style={{ '--pct': `${pct}%` }} aria-label={`${count} in bin, ${secondsLeft}s remaining`}>
        <span className="binBadgeCount">{count}</span>
      </div>
      <span className="binLabel" aria-hidden>Deleted</span>
      <button className="binBtn" onClick={onUndo} title="Undo last" aria-label="Undo last">
        <RotateCcw size={14} /><span className="binBtnText">Undo</span>
      </button>
      {count > 1 && (
        <button className="binBtn" onClick={onUndoAll} title="Undo all" aria-label="Undo all">
          <RotateCcw size={14} /><span className="binBtnText">All</span>
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
  const [errorNotice, setErrorNotice] = useState(null);
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
  const [passwordsById, setPasswordsById] = useState({});
  const [undoSeconds, setUndoSeconds] = useState(0);

  const [showTrashDock, setShowTrashDock] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);


  const inputRef = useRef(null);
  const canvasRef = useRef(null);
  const xhrRef = useRef(null);
  
  // Tile refs for fly animation
  const tileRefs = useRef(new Map());
  const setTileRef = (id, node) => {
    if (node) tileRefs.current.set(id, node);
    else tileRefs.current.delete(id);
  };

  const trashDockRef = useRef(null);
  const lastFlightAtRef = useRef(0);

  // Animate a reverse ghost from bin to a tile's current position
  function animateReturnFromBin(itemId) {
    try {
      const binEl = trashDockRef.current;
      if (!binEl) return;
      const binRect = binEl.getBoundingClientRect();
      let tries = 0;
      function tick() {
        const tileEl = tileRefs.current.get(itemId);
        if (!tileEl) {
          if (tries++ < 30) requestAnimationFrame(tick);
          return;
        }
        const thumb = tileEl.querySelector('.pdfPreviewInner') || tileEl;
        const dst = thumb.getBoundingClientRect();
        const ghost = document.createElement('div');
        ghost.className = 'ghostReturn';
        Object.assign(ghost.style, {
          position: 'fixed', left: `${binRect.left + binRect.width/2 - dst.width/4}px`, top: `${binRect.top + binRect.height/2 - dst.height/4}px`,
          width: `${dst.width/2}px`, height: `${dst.height/2}px`, borderRadius: '10px', background: 'var(--tile-thumb)',
          boxShadow: '0 6px 18px rgba(0,0,0,.18)', zIndex: '1100', pointerEvents: 'none', opacity: '0.92', willChange: 'transform, opacity'
        });
        document.body.appendChild(ghost);
        const tx = dst.left - (binRect.left + binRect.width/2 - dst.width/4);
        const ty = dst.top - (binRect.top + binRect.height/2 - dst.height/4);
        ghost.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 0.92 },
          { transform: `translate(${tx}px, ${ty}px) scale(2)`, opacity: 0.0 }
        ], { duration: 420, easing: 'cubic-bezier(0.18,0.9,0.2,1)', fill: 'forwards' }).finished.then(() => ghost.remove());
      }
      requestAnimationFrame(tick);
    } catch {}
  }

  // Drag and Drop sensors - improved for mobile
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // Long-press to begin drag
        tolerance: 6, // Ignore tiny movements
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // use distance OR delay, not both
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (import.meta.env.DEV) console.debug('Sensors configured:', sensors);

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

  // online/offline banner
  useEffect(() => {
    function onOnline() { setIsOnline(true); }
    function onOffline() { setIsOnline(false); }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
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
    const locked = [];
    let totalAfter = files.length;
    // clear any previous errors when picking new files
    setErrorNotice(null);

    // Probe PDFs with pdf.js to detect encrypted/corrupt files
    const rejected = [];

    // Build duplicate signature set from current files
    const sig = new Set(files.map(x => `${x.file?.name || ''}__${x.file?.size || 0}`));
    let currentTotalBytes = files.reduce((s, x) => s + (x.file?.size || 0), 0);
    for (const f of selected) {
      // Enforce simple size and count limits inline (kept same as before)
      if (f.size / 1024 / 1024 > FILE_MAX_MB) { rejected.push({ file: f, reason: `exceeds ${FILE_MAX_MB}MB` }); continue; }
      if (totalAfter >= FILES_MAX) { rejected.push({ file: f, reason: `over file limit (${FILES_MAX})` }); continue; }
      const key = `${f.name || ''}__${f.size || 0}`;
      if (sig.has(key)) { rejected.push({ file: f, reason: 'duplicate' }); continue; }
      if ((currentTotalBytes + f.size) / (1024*1024) > TOTAL_MAX_MB) { rejected.push({ file: f, reason: `over total size limit (${TOTAL_MAX_MB}MB)` }); continue; }

      const ok = await probePdfReadable(f);
      if (!ok.ok) {
        const isEncrypted = ok.code && String(ok.code).toLowerCase().includes('password');
        rejected.push({ file: f, reason: isEncrypted ? 'password-protected' : 'unreadable' });
        locked.push(f);
      } else {
        accepted.push(f);
        totalAfter++;
        sig.add(key);
        currentTotalBytes += f.size;
      }
    }
    if (rejected.length) {
      const names = rejected.map(r => `${r.file.name} (${r.reason})`).slice(0, 5).join(', ');
      setErrorNotice(`Some files will be skipped: ${names}. Use different PDFs or decrypt them before merging.`);
    }
    if (!accepted.length && !locked.length) return;

    const added = accepted.map((f, i) => ({
      id: rid(),
      file: f,
      originalIndex: files.length + i,
      rotate: 0,
      fly: false,
      locked: false,
    }));
    const lockedItems = locked.map((f, i) => ({
      id: rid(),
      file: f,
      originalIndex: files.length + accepted.length + i,
      rotate: 0,
      fly: false,
      locked: true,
    }));
    
    // Generate thumbnails and get page counts for new files (only non-locked)
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
    
    setFiles((prev) => [...prev, ...added, ...lockedItems]);
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
        setUndoSeconds(8);
        setShowTrashDock(false);
      }, 460);
      return;
    }

    // Compute precise centers (thumbnail content area for start, bin mouth for target)
    const thumbInner = tileEl.querySelector('.pdfPreviewInner') || tileEl;
    const startRect = thumbInner.getBoundingClientRect();
    const binRect = binEl.getBoundingClientRect();
    const start = {
      x: Math.round(startRect.left + startRect.width/2),
      y: Math.round(startRect.top + startRect.height/2),
    };
    const target = {
      x: Math.round(binRect.left + binRect.width/2),
      y: Math.round(binRect.top + binRect.height/2 - 4), // mouth bias
    };

    // Create a ghost clone to animate in a fixed overlay
    const ghost = tileEl.cloneNode(true);
    ghost.classList.add('ghostThrow');
    Object.assign(ghost.style, {
      position: 'fixed', left: `${startRect.left}px`, top: `${startRect.top}px`,
      width: `${startRect.width}px`, height: `${startRect.height}px`, zIndex: '1100', pointerEvents: 'none',
      willChange: 'transform, opacity'
    });
    document.body.appendChild(ghost);

    // Hide the real tile immediately
    setFiles(prev => prev.map(x => x.id === id ? ({ ...x, fly: true }) : x));

    // Stagger if multiple deletes are triggered quickly
    const now = performance.now();
    const elapsed = now - (lastFlightAtRef.current || 0);
    const delay = Math.max(0, ANIM.staggerMs - elapsed);
    lastFlightAtRef.current = now + delay;

    setTimeout(() => {
      // Build a quadratic bezier approx via WAAPI keyframes
      const cp = {
        x: start.x + (target.x - start.x) * 0.6,
        y: Math.min(start.y, target.y) - Math.abs(start.y - target.y) * 0.35,
      };
      const frames = 24;
      const kfs = [];
      for (let i = 0; i <= frames; i++) {
        const t = i / frames;
        const bx = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * cp.x + t * t * target.x;
        const by = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * cp.y + t * t * target.y;
        const tx = bx - startRect.left;
        const ty = by - startRect.top;
        const fade = i > frames - 6 ? (1 - (i - (frames - 6)) / 6) : 1;
        kfs.push({ transform: `translate(${tx}px, ${ty}px) scale(${1 - t*0.15})`, opacity: Math.max(0.85, fade) });
      }
      // Crumple pre-phase
      ghost.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 0.95 },
        { transform: 'translate(0,0) scaleX(0.88) scaleY(0.8) rotate(2deg)', opacity: 0.9 }
      ], { duration: ANIM.crumpleMs, easing: 'ease-out' }).finished.then(() => {
        ghost.animate(kfs, { duration: ANIM.throwMs - 160, easing: 'cubic-bezier(0.18,0.9,0.2,1)', fill: 'forwards' }).finished.then(() => {
          ghost.remove();
        });
      });
      // bin pulse reaction
      try { binEl?.classList.add('pulse'); setTimeout(() => binEl?.classList.remove('pulse'), ANIM.binPulseMs); } catch {}
    }, delay);

    // bin pulse reaction
    try { binEl?.classList.add('pulse'); setTimeout(() => binEl?.classList.remove('pulse'), 240); } catch {}

    // Commit the actual removal after animation timeline
    setTimeout(() => {
      setFiles(prev => prev.filter(x => x.id !== id));
      setTrash(prev => [...prev, { ...victim }]);
      setUndoSeconds(8);
      setTimeout(() => setShowTrashDock(false), 150);
    }, delay + ANIM.crumpleMs + (ANIM.throwMs - 160));
  }
  // Helper to restore items without duplicating IDs
  function restoreItems(items) {
    if (!items?.length) return;
    setFiles((prev) => {
      const ids = new Set(items.map((it) => it.id));
      const filtered = prev.filter((f) => !ids.has(f.id));
      const normalized = items.map((x) => ({ id: x.id, file: x.file, originalIndex: x.originalIndex, rotate: 0, fly: false }));
      return [...filtered, ...normalized];
    });
  }

  function restoreOne() {
    setTrash((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      restoreItems([last]);
      // reverse ghost animation
      animateReturnFromBin(last.id);
      return prev.slice(0, -1);
    });
    setUndoSeconds(0);
  }
  function restoreAll() {
    setTrash((prev) => {
      if (!prev.length) return prev;
      // Deduplicate and restore all in one pass
      const uniqueById = Array.from(new Map(prev.map((x) => [x.id, x])).values());
      restoreItems(uniqueById);
      // animate each with small stagger
      uniqueById.forEach((it, idx) => setTimeout(() => animateReturnFromBin(it.id), idx * 70));
      return [];
    });
    setUndoSeconds(0);
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
    setErrorNotice(null);
    
    // Safety timeout to prevent stuck busy state
    const safetyTimeout = setTimeout(() => {
      console.log('Safety timeout: resetting busy state');
      setBusy(false);
    }, 30000); // 30 seconds timeout

    const fd = new FormData();
    files.forEach(({ file }) => fd.append("files[]", file, file.name));
    // Send passwords[] aligned to files order (blank if none), and ask server to skip locked
    files.forEach((it) => fd.append('passwords[]', passwordsById[it.id] || ''));
    fd.append('skip_locked', 'true');

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
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
      setErrorNotice("Network error while contacting the merge API.");
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
          setErrorNotice("Server did not include a download URL. Please try again.");
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
      let msg = data?.error?.message || (isJSON ? "Merge failed." : "Merge failed — server returned HTML (check URL/CORS).");
      if (status === 422 && data?.error?.code === 'invalid_or_encrypted_pdf') {
        msg = "One or more PDFs are password-protected or corrupted. Please use a different PDF or decrypt the file before merging.";
      } else {
        if (status === 404) msg += " (404 Not Found — check VITE_API_BASE and /v1/pdf/merge)";
        if (status === 413) msg += " (413 Payload Too Large — server upload limit too low)";
        if (status === 415) msg += " (415 Unsupported Media Type — multipart/form-data issue)";
        if (status === 422) msg += " (422 — fewer than 2 PDFs or invalid files)";
      }
      clearTimeout(safetyTimeout);
      setErrorNotice(msg);
      setBusy(false);
    };
    
    console.log("POST →", import.meta.env.VITE_API_BASE + "/v1/pdf/merge");

    xhr.open("POST", `${API}/v1/pdf/merge`);
    xhr.withCredentials = true; // ✅ required for our CORS config
    xhr.send(fd);
  }
  
  // Undo countdown timer and purge when expired
  useEffect(() => {
    if (undoSeconds <= 0) return;
    const id = setInterval(() => {
      setUndoSeconds((s) => {
        if (s <= 1) {
          setTrash([]);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [undoSeconds]);

  function cancelUpload() {
    try { xhrRef.current?.abort(); } catch {}
    setBusy(false);
    setErrorNotice("Upload canceled.");
  }

  const hasFiles = files.length > 0;
  const mergeableCount = files.reduce((n, it) => n + ((it.locked ? Boolean(passwordsById[it.id]) : true) ? 1 : 0), 0);
  const totalPages = files.reduce((sum, it) => sum + ((it.locked && !passwordsById[it.id]) ? 0 : (pdfPageCounts[it.id] || 0)), 0);
  const exceedsPageLimit = totalPages > PAGES_MAX;

  // Drag and Drop handlers
  function handleDragStart(event) {
    const id = event.active.id;
    setActiveId(id);
    setActiveItem(files.find(f => f.id === id) || null);
    setIsDragging(true);
    
    // ✅ Freeze page scroll while dragging
    document.documentElement.classList.add('is-dragging');
    
    // ✅ Prevent iOS bounce/PTR during drag
    const preventTouchMove = (e) => {
      e.preventDefault();
    };
    document.addEventListener('touchmove', preventTouchMove, { passive: false });
    
    // Store the handler for cleanup
    document._preventTouchMove = preventTouchMove;
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
    
    // ✅ Restore page scroll after dragging
    document.documentElement.classList.remove('is-dragging');
    
    // ✅ Clean up iOS touchmove prevention
    if (document._preventTouchMove) {
      document.removeEventListener('touchmove', document._preventTouchMove);
      delete document._preventTouchMove;
    }
    
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
      {/* Error modal popup */}
      {errorNotice && (
        <div
          className="errorModalOverlay"
          onClick={() => setErrorNotice(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="errorModalCard"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffecec', color: '#9b1c1c', borderRadius: 12, padding: '18px 20px',
              border: '1px solid #f5c2c7',
              width: 'min(720px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{ display:'flex', alignItems:'flex-start', gap: 12 }}>
              <div style={{ color:'#9b1c1c', lineHeight: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div style={{ flex: 1 }}>{errorNotice}</div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setErrorNotice(null)}
                style={{ background:'#9b1c1c', color:'#fff', border:'1px solid #f5c2c7', padding:'8px 14px', borderRadius:8, cursor:'pointer' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
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
 
          

          {/* Offline banner */}
          {!isOnline && (
            <div style={{
              background:'#fff8e1', color:'#8a6d3b', border:'1px solid #faebcc',
              padding:'10px 12px', borderRadius:8, margin:'10px 16px'
            }}>
              You are offline. Reconnect to merge PDFs.
            </div>
          )}

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

          {/* Top-of-page indicators removed; will show inside Tips modal */}

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
                        passwordsById={passwordsById}
                        setPasswordForId={(id, pw) => setPasswordsById(prev => ({ ...prev, [id]: pw }))}
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



          {/* Trash Dock + Undo (fixed, bottom-left) */}
          {hasFiles && (showTrashDock || trash.length > 0) && (
            <div className="binOverlay">
              <div className={`trashDock ${trash.length > 0 ? 'active' : ''}`} ref={trashDockRef} title="Deleted files bin">
                <Trash2 size={20} />
              </div>
              <BinOverlay count={trash.length} onUndo={restoreOne} onUndoAll={restoreAll} secondsLeft={undoSeconds} />
            </div>
          )}

          {/* Mobile Merge Button - Always Visible */}
          {hasFiles && (
            <div className="mobileMergeButton">
              <button
                className={`ctaMerge mobileCtaMerge ${mergeableCount >= 2 && !busy && !exceedsPageLimit && isOnline ? "pulseBorderGreen" : ""}`}
                disabled={busy || mergeableCount < 2 || !isOnline || exceedsPageLimit}
                onClick={handleMerge}
              >
                <span>Merge PDF</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>
              </button>
              {exceedsPageLimit && (
                <div style={{ marginTop: 6, fontSize: 12, color:'#9b1c1c' }}>
                  Total pages exceed limit of {PAGES_MAX}. Remove files or split.
                </div>
              )}
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
                {/* Counters moved into Tips */}
                <div className="statusRow" style={{ marginTop: 0, marginBottom: 12 }}>
                  <div className="chip">Total pages: {totalPages}</div>
                  <div className="chip">Files left: {Math.max(0, FILES_MAX - files.length)}</div>
                  <div className="chip">Pages left: {Math.max(0, PAGES_MAX - totalPages)}</div>
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
                <button onClick={cancelUpload} style={{ marginTop: 12, background:'#111', color:'#fff', border:'0', padding:'8px 12px', borderRadius:6, cursor:'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Bin/Undo moved into binOverlay */}
          
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
 
          {/* Bin/Undo moved into binOverlay */}
          
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
