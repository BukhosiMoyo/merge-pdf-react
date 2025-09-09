// src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Merge from "./pages/Merge.jsx";
import Download from "./pages/Download.jsx";
import Viewer from "./pages/Viewer.jsx";

export default function App() {
  // Set HTML lang attribute for South Africa targeting
  useEffect(() => {
    const currentLang = document.documentElement.getAttribute('lang');
    if (!currentLang) {
      document.documentElement.setAttribute('lang', 'en-ZA');
    }
  }, []);
  return (
    <Routes>
      {/* Root path - redirect to English */}
      <Route path="/" element={<Navigate to="/en" replace />} />
      
      {/* Language-specific routes */}
      <Route path="/en" element={<Merge />} />
      <Route path="/af" element={<Merge />} />
      <Route path="/zu" element={<Merge />} />
      <Route path="/xh" element={<Merge />} />
      
      {/* Pretty download routes with locale, id, and optional name */}
      <Route path="/en/download/:id/:name?" element={<Download />} />
      <Route path="/af/download/:id/:name?" element={<Download />} />
      <Route path="/zu/download/:id/:name?" element={<Download />} />
      <Route path="/xh/download/:id/:name?" element={<Download />} />
      
      {/* PDF Viewer routes */}
      <Route path="/en/view/:id/:name?" element={<Viewer />} />
      <Route path="/af/view/:id/:name?" element={<Viewer />} />
      <Route path="/zu/view/:id/:name?" element={<Viewer />} />
      <Route path="/xh/view/:id/:name?" element={<Viewer />} />
      
      {/* Legacy download routes for backward compatibility */}
      <Route path="/en/download" element={<Download />} />
      <Route path="/af/download" element={<Download />} />
      <Route path="/zu/download" element={<Download />} />
      <Route path="/xh/download" element={<Download />} />
      
      {/* Catch-all - redirect to English */}
      <Route path="*" element={<Navigate to="/en" replace />} />
    </Routes>
  );
}
