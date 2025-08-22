// src/state/LocaleContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STRINGS = {
  en: {
    // App + download page
    appName: "Merge PDF",
    download_ready: "Your file is ready",
    download_sub: "We merged your PDFs into a single document.",
    btn_download: "Download PDF",
    btn_copy: "Copy link",
    btn_open: "Open PDF",
    btn_new: "New merge",
    btn_email: "Email PDF",

    // Homepage / merge page
    hero_title: "Merge your PDFs",
    hero_sub: "Drop files here or use the button below",
    add_files: "Select PDF files",
    sort_az: "Sort A → Z",
    refer_original: "Refer to original",
    merge_cta: "Merge files",
    tip_title: "Tips",
    tip_drop: "Drag & drop files to reorder",
    tip_delete: "Click ✕ to remove a file",
    tip_pages: "We keep page order unless you reorder",
  },

  af: {
    appName: "Voeg PDF saam",
    download_ready: "Jou lêer is gereed",
    download_sub: "Ons het jou PDF’s in ’n enkele dokument saamgevoeg.",
    btn_download: "Laai PDF af",
    btn_copy: "Kopieer skakel",
    btn_open: "Maak PDF oop",
    btn_new: "Nuwe samesmelting",
    btn_email: "E-pos PDF",

    hero_title: "Voeg jou PDF’s saam",
    hero_sub: "Los lêers hier of gebruik die knoppie hieronder",
    add_files: "Kies PDF-lêers",
    sort_az: "Sorteer A → Z",
    refer_original: "Verwys na oorspronklike",
    merge_cta: "Voeg lêers saam",
    tip_title: "Wenke",
    tip_drop: "Sleep en los lêers om te herrangskik",
    tip_delete: "Klik ✕ om ’n lêer te verwyder",
    tip_pages: "Ons behou bladsyvolgorde tensy jy herrangskik",
  },

  zu: {
    appName: "Hlanganisa i-PDF",
    download_ready: "Ifayela lakho selikulungele",
    download_sub: "Sihlanganise ama-PDF akho abe idokhumenti eyodwa.",
    btn_download: "Landa i-PDF",
    btn_copy: "Kopisha isixhumanisi",
    btn_open: "Vula i-PDF",
    btn_new: "Ukuhlanganisa okusha",
    btn_email: "Thumela i-PDF nge-imeyili",

    hero_title: "Hlanganisa ama-PDF akho",
    hero_sub: "Donselela amafayela lapha noma usebenzise inkinobho engezansi",
    add_files: "Khetha amafayela e-PDF",
    sort_az: "Hlunga A → Z",
    refer_original: "Bheka ku-okhiye wokuqala",
    merge_cta: "Hlanganisa amafayela",
    tip_title: "Amathiphu",
    tip_drop: "Donselela bese uyadonsa ukuze uhlele kabusha",
    tip_delete: "Chofoza ✕ ukuze ususe ifayela",
    tip_pages: "Sigcina ukuhleleka kwamakhasi ngaphandle kokuthi ushintshe",
  },

  xh: {
    appName: "Dibanisa i-PDF",
    download_ready: "Ifayile yakho ilungile",
    download_sub: "Sihlanganise ii-PDF zakho zaba lixwebhu elinye.",
    btn_download: "Khuphela i-PDF",
    btn_copy: "Kopa ikhonkco",
    btn_open: "Vula i-PDF",
    btn_new: "Udibaniso olutsha",
    btn_email: "Thumela i-PDF nge-imeyile",

    hero_title: "Dibanisa ii-PDF zakho",
    hero_sub: "Tsala ulahle iifayile apha okanye usebenzise iqhosha elingezantsi",
    add_files: "Khetha iifayile ze-PDF",
    sort_az: "Hlela A → Z",
    refer_original: "Bhekisa kweyoqobo",
    merge_cta: "Dibanisa iifayile",
    tip_title: "Iingcebiso",
    tip_drop: "Tsala ulahle ukuze uphinde uhlele",
    tip_delete: "Cofa ✕ ukuze ususe ifayile",
    tip_pages: "Sigcina ulungelelwaniso lwamaphepha ngaphandle kokuba uluguqule",
  },
};


const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const initial = (() => {
    const saved = localStorage.getItem("locale");
    if (saved && STRINGS[saved]) return saved;
    return "en";
  })();

  const [locale, setLocale] = useState(initial);

  useEffect(() => {
    document.documentElement.setAttribute("lang", locale);
    localStorage.setItem("locale", locale);
  }, [locale]);

  const t = useMemo(() => {
    const dict = STRINGS[locale] || STRINGS.en;
    return (key) => dict[key] ?? key;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within <LocaleProvider>");
  return ctx;
}
