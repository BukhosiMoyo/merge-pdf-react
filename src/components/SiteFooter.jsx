// src/components/SiteFooter.jsx
import React from "react";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="siteFooter">
      <div className="footerInner">
        <div className="footerLeft">
          <strong>Merge PDF</strong> • © {year}
        </div>
        <nav className="footerNav">
          {/* placeholders for future tools/links */}
          <a href="/" className="footerLink">Home</a>
          <a href="#" className="footerLink" aria-disabled="true">Tools (soon)</a>
          <a href="#" className="footerLink" aria-disabled="true">Privacy</a>
        </nav>
      </div>
    </footer>
  );
}
