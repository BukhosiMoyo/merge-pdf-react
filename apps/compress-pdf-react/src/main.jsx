import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";


const SUPPORTED = ["en", "af", "zu", "xh"];
const fallback = "en";

function RedirectToBestLocale() {
  // Prefer previously chosen locale if present
  const saved = localStorage.getItem("locale");
  const best = SUPPORTED.includes(saved) ? saved : fallback;
  return <Navigate to={`/${best}`} replace />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* no locale -> redirect to best guess */}
        <Route path="/" element={<RedirectToBestLocale />} />
        {/* locale segment drives the app */}
        <Route path="/:locale" element={<App />} />
        {/* anything else -> go home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
