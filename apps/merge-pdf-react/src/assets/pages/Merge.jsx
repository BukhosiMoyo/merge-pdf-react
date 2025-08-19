import {useEffect, useMemo, useRef, useState} from 'react'
import {useParams} from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, rectSortingStrategy, useSortable
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'

const LOCALE_STRINGS = {
  en: {
    h1: 'Merge PDF files',
    sub: 'Combine PDFs in the order you want. Drag & drop or click the big button.',
    selectBtn: 'Select PDF files',
    dropHint: 'or drop PDFs here',
    sortAZ: 'Sort A→Z',
    sortZA: 'Sort Z→A',
    sortOriginal: 'Original order',
    tipsTitle: 'Tips',
    tipsBody: 'Add at least two PDFs. Drag to reorder or sort by name.',
    mergeBtn: 'Merge PDF',
    filesCount: n => `${n} file${n===1?'':'s'} selected`,
  },
  af: {
    h1: 'Voeg PDF‑lêers saam',
    sub: 'Kombineer PDF’s in jou volgorde. Sleep en los of klik die groot knoppie.',
    selectBtn: 'Kies PDF‑lêers',
    dropHint: 'of laat val PDF’s hier',
    sortAZ: 'Sorteer A→Z',
    sortZA: 'Sorteer Z→A',
    sortOriginal: 'Oorspronklike volgorde',
    tipsTitle: 'Wenke',
    tipsBody: 'Voeg minstens twee PDF’s by. Sleep om te herrangskik of sorteer volgens naam.',
    mergeBtn: 'Voeg PDF saam',
    filesCount: n => `${n} lêer${n===1?'':'s'} gekies`,
  },
  zu: {
    h1: 'Hlanganisa ama‑PDF',
    sub: 'Hlanganisa ama‑PDF ngokulandelana okufunayo. Donsa‑uphonse noma chofoza inkinobho enkulu.',
    selectBtn: 'Khetha ama‑PDF',
    dropHint: 'noma uwaphonse lapha',
    sortAZ: 'Hlela A→Z',
    sortZA: 'Hlela Z→A',
    sortOriginal: 'Uhlelo lokuqala',
    tipsTitle: 'Amathiphu',
    tipsBody: 'Faka okungenani ama‑PDF amabili. Donsa ukuze uhlele kabusha noma hlela ngegama.',
    mergeBtn: 'Hlanganisa i‑PDF',
    filesCount: n => `${n} amafayela okukhethiwe`.replace('1 amafayela','1 ifayela'),
  },
  xh: {
    h1: 'Dibanisa iiPDF',
    sub: 'Dibanisa iiPDF ngendlela ofuna ngayo. Tsala‑ulahlwe okanye ucofe iqhosha elikhulu.',
    selectBtn: 'Khetha iiPDF',
    dropHint: 'okanye ulahle apha',
    sortAZ: 'Hlela A→Z',
    sortZA: 'Hlela Z→A',
    sortOriginal: 'Ulandelelwano lokuqala',
    tipsTitle: 'Iingcebiso',
    tipsBody: 'Yongeza ubuncinane iiPDF ezimbini. Tsala ukuze ulungelelanise okanye uhlele ngegama.',
    mergeBtn: 'Dibanisa i‑PDF',
    filesCount: n => `${n} fayile zikhethiwe`,
  },
}

function useT(){ const {locale='en'}=useParams(); return {t: LOCALE_STRINGS[locale]||LOCALE_STRINGS.en, locale} }

function SortableTile({id, file, onRemove}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id})
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging?10:'auto' }
  return (
    <article ref={setNodeRef} style={style} className="mergeTile" {...attributes} {...listeners}>
      <div className="mergeTile__thumb"><div className="thumbStub">PDF</div></div>
      <div className="mergeTile__meta" title={file.name}>
        <span className="name">{file.name}</span>
        <button className="iconBtn danger" onClick={()=>onRemove(id)} aria-label="Remove">✕</button>
      </div>
    </article>
  )
}

export default function Merge(){
  const { t, locale } = useT()
  const [files, setFiles] = useState([]) // [{id, file, originalIndex}]
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(()=> {
    document.title = t.h1
    const m = document.querySelector('meta[name="description"]')||(()=>{const x=document.createElement('meta');x.name='description';document.head.appendChild(x);return x})()
    m.content = t.sub
  }, [t])

  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint:{distance:5}}))

  function onPick(e){
    const added = Array.from(e.target.files||[])
      .filter(f => f.type==='application/pdf')
      .map((f,i)=>({ id: rid(), file: f, originalIndex: files.length + i }))
    setFiles(prev => [...prev, ...added])
    e.target.value=''
  }
  function removeById(id){ setFiles(prev => prev.filter(x=>x.id!==id)) }
  function onDragEnd(e){
    const {active, over} = e; if(!over||active.id===over.id) return
    const oldIndex = files.findIndex(x=>x.id===active.id)
    const newIndex = files.findIndex(x=>x.id===over.id)
    setFiles(arrayMove(files, oldIndex, newIndex))
  }
  function sortBy(mode){
    if(mode==='az') setFiles(prev=>[...prev].sort((a,b)=>a.file.name.localeCompare(b.file.name,undefined,{numeric:true})))
    else if(mode==='za') setFiles(prev=>[...prev].sort((a,b)=>b.file.name.localeCompare(a.file.name,undefined,{numeric:true})))
    else setFiles(prev=>[...prev].sort((a,b)=>a.originalIndex-b.originalIndex))
  }
  async function handleMerge(){
    if(files.length<2||busy) return
    setBusy(true)
    try{
      const fd = new FormData()
      files.forEach(({file})=>fd.append('files[]', file, file.name))
      const res = await fetch(import.meta.env.VITE_API_BASE + '/v1/pdf/merge', {method:'POST', body:fd})
      const json = await res.json()
      if(!res.ok) throw new Error(json?.error?.message || 'Merge failed')
      window.location.href = json.output.download_url
    } catch(e){ alert(e.message) } finally { setBusy(false) }
  }

  const hasFiles = files.length>0
  return (
    <main className="mergeWrap">
      {!hasFiles ? (
        <section className="zeroState">
          <h1 className="titleClamp">{t.h1}</h1>
          <p className="subtleClamp">{t.sub}</p>
          <button className="ctaHuge" onClick={()=>inputRef.current?.click()}>{t.selectBtn}</button>
          <p className="dropHint">{t.dropHint}</p>
          <input ref={inputRef} type="file" accept="application/pdf" multiple onChange={onPick} hidden />
        </section>
      ) : (
        <section className="builder">
          <header className="builderTop">
            <div className="left">
              <button className="btnGhost" onClick={()=>inputRef.current?.click()}>➕ {t.filesCount(files.length)}</button>
              <input ref={inputRef} type="file" accept="application/pdf" multiple onChange={onPick} hidden />
            </div>
            <div className="right sortBtns">
              <button className="btnGhost" onClick={()=>sortBy('az')}>{t.sortAZ}</button>
              <button className="btnGhost" onClick={()=>sortBy('za')}>{t.sortZA}</button>
              <button className="btnGhost" onClick={()=>sortBy('orig')}>{t.sortOriginal}</button>
            </div>
          </header>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={files.map(f=>f.id)} strategy={rectSortingStrategy}>
              <div className="tilesGrid">
                {files.map(({id,file})=>( <SortableTile key={id} id={id} file={file} onRemove={removeById}/> ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="stickyCTA">
            <button className="ctaMerge" disabled={busy||files.length<2} onClick={handleMerge}>
              {busy? 'Merging…' : t.mergeBtn}
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

function rid(n=8){ const a=new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a).map(x=>x.toString(16).padStart(2,'0')).join('') }
