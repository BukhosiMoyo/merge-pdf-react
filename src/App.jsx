// src/App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import Merge from "./pages/Merge.jsx";
import Download from "./pages/Download.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Merge />} />
      <Route path="/download" element={<Download />} />
      <Route path="*" element={<div>Not found</div>} />
    </Routes>
  );
}
