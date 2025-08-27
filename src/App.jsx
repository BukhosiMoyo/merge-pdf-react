// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Merge from "./pages/Merge.jsx";
import Download from "./pages/Download.jsx";

export default function App() {
  return (
    <Routes>
      {/* Root path - redirect to English */}
      <Route path="/" element={<Navigate to="/en" replace />} />
      
      {/* Language-specific routes */}
      <Route path="/en" element={<Merge />} />
      <Route path="/af" element={<Merge />} />
      <Route path="/zu" element={<Merge />} />
      <Route path="/xh" element={<Merge />} />
      
      {/* Download routes */}
      <Route path="/en/download" element={<Download />} />
      <Route path="/af/download" element={<Download />} />
      <Route path="/zu/download" element={<Download />} />
      <Route path="/xh/download" element={<Download />} />
      
      {/* Catch-all - redirect to English */}
      <Route path="*" element={<Navigate to="/en" replace />} />
    </Routes>
  );
}
