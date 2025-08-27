import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import StatsAndFAQ from "../components/StatsAndFAQ.jsx";


import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* pdf.js for thumbnails */
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
GlobalWorkerOptions.workerSrc = pdfjsWorker;

/* lucide icons */
import {
  Plus,
  ArrowUpDown,
  RotateCcw,
  X as XIcon,
  FileText,
  Trash2,
} from "lucide-react";


const FILES_MAX = 20;
const FILE_MAX_MB = 20;

/** ✅ single source of truth for the API base */
const API = import.meta.env.VITE_API_BASE || "http://localhost:4000";

if (!import.meta.env.VITE_API_BASE) {
  console.warn("VITE_API_BASE not set. Using fallback:", API);
}


/* ---------- Sortable Tile ---------- */
function SortableTile({ id, file, thumb, pages, onRemove, onRotate, onViewPdf, rotate = 0 }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : "auto",
  };
  const size =
    file.size < 1024
      ? `${file.size} B`
      : file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(0)} KB`
      : `${(file.size / 1024 / 1024).toFixed(2)} MB`;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="mergeTile"
      {...attributes}
      {...listeners}
    >
      <div className="mergeTile__thumb">
        <div className="fileBadge">
          <FileText size={14} />
          PDF
        </div>

        <div className="thumbTooltip">
          <div className="tooltip above">
            {size} • {pages ?? "…"} pages
          </div>
        </div>

        {thumb ? (
          <img 
            src={thumb} 
            alt="" 
            style={{ 
              transform: `rotate(${rotate}deg)`,
              transition: 'transform 0.3s ease'
            }}
            onClick={() => onViewPdf(id, file, thumb)}
            className="clickableThumb"
          />
        ) : (
          <div className="thumbStub">PDF</div>
        )}

        <div className="tileActions">
          <div className="tooltipHost">
            <button
              className="iconBtn square rotate"
              onClick={() => onRotate(id)}
              aria-label="Rotate file"
            >
              <RotateCcw size={18} />
            </button>
            <div className="tooltip above">Rotate file</div>
          </div>

          <div className="tooltipHost">
            <button
              className="iconBtn square danger"
              onClick={() => onRemove(id)}
              aria-label="Remove file"
            >
              <XIcon size={18} strokeWidth={2.5} />
            </button>
            <div className="tooltip above">Remove file</div>
          </div>
        </div>
      </div>

      <div className="mergeTile__meta tooltipHost">
        <span className="name">{file.name}</span>
        <div className="tooltip above">{file.name}</div>
      </div>
    </article>
  );
}

/* ---------- Bin/Undo ---------- */
function BinOverlay({ count, onUndo, onUndoAll }) {
  if (!count) return null;
  return (
    <div className="binOverlay">
      <div className="bin hot" title="Deleted files bin">
        <Trash2 />
        <div className="binBadge">{count}</div>
      </div>
      <div className="undoToast">
        <button onClick={onUndo}>↩︎ Undo</button>
        {count > 1 && (
          <button onClick={onUndoAll} style={{ background: "#111", marginLeft: 6 }}>
            ↩︎ Undo all
          </button>
        )}
      </div>
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
  const [dragging, setDragging] = useState(false);
  const [shuffleKey, setShuffleKey] = useState(0);
  const [thumbs, setThumbs] = useState({}); // id -> dataURL
  const [pageCounts, setPageCounts] = useState({}); // id -> number
  const [dropActive, setDropActive] = useState(false);
  const [trash, setTrash] = useState([]); // [{id,file,originalIndex,thumb,pages}]
  const [controlsCompact, setControlsCompact] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [viewingPdf, setViewingPdf] = useState(null);

  const inputRef = useRef(null);
  const canvasRef = useRef(null);

  // meta
  useEffect(() => {
    document.title = "Merge PDF files";
    const m =
      document.querySelector('meta[name="description"]') ||
      (() => {
        const x = document.createElement("meta");
        x.name = "description";
        document.head.appendChild(x);
        return x;
      })();
    m.content = "Combine PDFs in the order you want. Drag & drop or click the big button.";
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

  // sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // previews
  async function generateThumbAndPagesMeta(id, file) {
    try {
      const ab = await file.arrayBuffer();
      const task = getDocument({ data: ab });
      const pdf = await task.promise;

      setPageCounts((prev) => ({ ...prev, [id]: pdf.numPages }));

      const page = await pdf.getPage(1);
      const desiredH = 220;
      const vp1 = page.getViewport({ scale: 1 });
      const scale = desiredH / vp1.height;
      const vp = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
      canvas.width = Math.max(1, Math.floor(vp.width));
      canvas.height = Math.max(1, Math.floor(vp.height));

      await page.render({ canvasContext: ctx, viewport: vp, intent: "display" }).promise;
      const url = canvas.toDataURL("image/png");
      setThumbs((prev) => ({ ...prev, [id]: url }));
    } catch (err) {
      console.error("preview failed", err);
      setThumbs((prev) => ({ ...prev, [id]: null }));
    }
  }

  // intake files
  function isPdf(f) {
    return f?.type === "application/pdf" || /\.pdf$/i.test(f?.name || "");
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
    setFiles((prev) => [...prev, ...added]);

    for (const it of added) {
      // eslint-disable-next-line no-await-in-loop
      await generateThumbAndPagesMeta(it.id, it.file);
    }
  }
  function onPick(e) {
    acceptFiles(e.target.files);
    e.target.value = "";
  }

  // dropzone
  function onDragOver(e) {
    e.preventDefault();
    setDropActive(true);
  }
  function onDragLeave(e) {
    if (e.currentTarget === e.target) setDropActive(false);
  }
  function onDrop(e) {
    e.preventDefault();
    setDropActive(false);
    if (e.dataTransfer?.files?.length) acceptFiles(e.dataTransfer.files);
  }

  // scroll listener to compact controls
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onScroll = () => setControlsCompact(el.scrollTop > 16);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // sortable
  function onDragStart() {
    setDragging(true);
    document.body.style.overflow = "hidden";
  }
  function onDragEnd(e) {
    setDragging(false);
    document.body.style.overflow = "";
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = files.findIndex((x) => x.id === active.id);
    const newIndex = files.findIndex((x) => x.id === over.id);
    setFiles(arrayMove(files, oldIndex, newIndex));
  }

  // rotation
  function rotateById(id) {
    setFiles((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, rotate: (x.rotate + 90) % 360 } : x
      )
    );
  }

  // PDF viewer
  function onViewPdf(id, file, thumb) {
    setViewingPdf({ id, file, thumb, pages: pageCounts[id] });
    setPdfViewerOpen(true);
  }

  // delete / undo
  function removeById(id) {
    const victim = files.find((x) => x.id === id);
    if (!victim) return;
    const vThumb = thumbs[id];
    const vPages = pageCounts[id];
    setFiles((prev) => prev.map((x) => (x.id === id ? { ...x, fly: true } : x)));
    setTimeout(() => {
      setFiles((prev) => prev.filter((x) => x.id !== id));
      setTrash((prev) => [...prev, { ...victim, thumb: vThumb, pages: vPages }]);
    }, 350);
  }
  function restoreOne() {
    setTrash((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setFiles((f) => [
        ...f,
        { id: last.id, file: last.file, originalIndex: last.originalIndex, rotate: 0, fly: false },
      ]);
      if (last.thumb) setThumbs((th) => ({ ...th, [last.id]: last.thumb }));
      if (last.pages) setPageCounts((pc) => ({ ...pc, [last.id]: last.pages }));
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

      // restore thumbs
      setThumbs((th) => {
        const n = { ...th };
        prev.forEach((x) => {
          if (x.thumb) n[x.id] = x.thumb;
        });
        return n;
      });

      // restore page counts
      setPageCounts((pc) => {
        const n = { ...pc };
        prev.forEach((x) => {
          if (x.pages) n[x.id] = x.pages;
        });
        return n;
      });

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
    setShuffleKey((x) => x + 1);
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
        const url = data?.output?.download_url;
        if (!url) {
          alert("Server did not include a download URL.");
          setBusy(false);
          return;
        }
        const n = parseInt(localStorage.getItem("merged_counter") || "0", 10) + 1;
        localStorage.setItem("merged_counter", String(n));
        const name = `merged-${n}.pdf`;
        nav(`/${locale}/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`, {
          replace: true,
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
      alert(msg);
      setBusy(false);
    };
    
    console.log("POST →", import.meta.env.VITE_API_BASE + "/v1/pdf/merge");

    xhr.open("POST", `${API}/v1/pdf/merge`);
    xhr.withCredentials = true; // ✅ required for our CORS config
    xhr.send(fd);
  }

  const hasFiles = files.length > 0;

  return (
    <Layout
      headerProps={{
        theme,
        onToggleTheme: toggleTheme,
        locale,
        setLocale,
      }}
    >
      <div
        className={`appShell ${!hasFiles ? "appShell--no-sidebar" : ""}`}
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
                  <span className="btnIcon">
                    <Plus size={18} />
                  </span>
                  <span className="btnLabel">Select PDF files</span>
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
               {/* Controls (collapse to icons on scroll) */}
               <div className={`controlsRow ${controlsCompact ? "controlsRow--compact" : ""}`}>
                 <div className="tooltipHost">
                   <button
                     className="btnGhost btnAdd btnAdd--pulse"
                     onClick={() => inputRef.current?.click()}
                   >
                     <span className="btnIcon">
                       <Plus size={18} />
                     </span>
                     <span className="btnLabel">
                       {files.length} file{files.length === 1 ? "" : "s"} added
                     </span>
                   </button>
                   <div className="tooltip bottom">Add more files</div>
                 </div>
 
                 <div className="tooltipHost">
                   <button className="btnGhost btnGhost--outlined2" onClick={toggleSort}>
                     <span className="btnIcon">
                       <ArrowUpDown size={18} />
                     </span>
                     <span className="btnLabel">A↕Z</span>
                   </button>
                   <div className="tooltip bottom">Sort A→Z</div>
                 </div>
 
                 <div className="tooltipHost">
                   <button className="btnGhost btnGhost--outlined2" onClick={restoreOriginal}>
                     <span className="btnIcon">
                       <RotateCcw size={18} />
                     </span>
                     <span className="btnLabel">Original</span>
                   </button>
                   <div className="tooltip bottom">Revert to original</div>
                 </div>
               </div>
 
               {/* Grid */}
               <DndContext
                 sensors={sensors}
                 collisionDetection={closestCenter}
                 onDragStart={onDragStart}
                 onDragEnd={onDragEnd}
               >
                 <SortableContext items={files.map((f) => f.id)} strategy={rectSortingStrategy}>
                   <div
                     className={`tilesGrid ${dragging ? "dragging" : ""} ${
                       shuffleKey ? "shuffleAnim" : ""
                     }`}
                   >
                     {files.map(({ id, file, fly, rotate = 0 }) => (
                       <div key={id} className={fly ? "flyOut" : ""}>
                         <SortableTile
                           id={id}
                           file={file}
                           thumb={thumbs[id]}
                           pages={pageCounts[id]}
                           rotate={rotate}
                           onRemove={removeById}
                           onRotate={rotateById}
                         />
                       </div>
                     ))}
                   </div>
                 </SortableContext>
               </DndContext>
 
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
 
        {/* Sidebar: only render when there are files */}
        {hasFiles ? (
          <aside className="sidebarPane">
            <div className="tipCard">
              <h3>Tips</h3>
              <p>Drag tiles to reorder. Use A↕Z to sort by name. Original restores first‑added order.</p>
            </div>
            <div className="sidebarCTA">
              <button
                className={`ctaMerge ${files.length >= 2 && !busy ? "pulseBorderGreen" : ""}`}
                disabled={busy || files.length < 2}
                onClick={handleMerge}
              >
                Merge PDF
              </button>
            </div>
          </aside>
        ) : null}
        
                 {/* Mobile Tips Toggle Button */}
         {hasFiles && (
           <button
             className="mobileTipsToggle"
             onClick={() => {
               const sidebar = document.querySelector('.sidebarPane');
               const button = document.querySelector('.mobileTipsToggle');
               if (sidebar && button) {
                 sidebar.classList.toggle('sidebarPane--show-tips');
                 button.classList.toggle('active');
               }
             }}
             title="Toggle tips"
             aria-label="Toggle tips"
           >
             👁
           </button>
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

        {/* PDF Viewer Modal */}
        {pdfViewerOpen && viewingPdf && (
          <div className="pdfViewerModal" onClick={() => setPdfViewerOpen(false)}>
            <div className="pdfViewerContent" onClick={(e) => e.stopPropagation()}>
              <div className="pdfViewerHeader">
                <h3>{viewingPdf.file.name}</h3>
                <button 
                  className="pdfViewerClose"
                  onClick={() => setPdfViewerOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="pdfViewerBody">
                <img 
                  src={viewingPdf.thumb} 
                  alt="PDF Preview" 
                  className="pdfViewerImage"
                />
                <div className="pdfViewerInfo">
                  <p><strong>Pages:</strong> {viewingPdf.pages || 'Unknown'}</p>
                  <p><strong>Size:</strong> {(viewingPdf.file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Layout>
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
