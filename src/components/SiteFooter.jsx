// src/components/SiteFooter.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "../state/LocaleContext.jsx";

export default function SiteFooter() {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const year = new Date().getFullYear();

  const handleCompressClick = () => {
    // Navigate to the compress PDF tool
    // For now, we'll use a placeholder URL since the compress tool might be in a different app
    window.open('https://compresspdf.co.za', '_blank');
  };

  return (
    <footer className="siteFooter">
      <div className="footerContent">
        <div className="footerSection">
          <h3>More PDF tools</h3>
          <button className="footerCompressBtn" onClick={handleCompressClick}>
            Compress PDF
          </button>
        </div>
        
        <div className="footerSection">
          <div className="footerBrand">
            <strong>Merge PDF</strong> • © {year}
          </div>
          <nav className="footerNav">
            <a href="/" className="footerLink">Home</a>
            <a href="#" className="footerLink" aria-disabled="true">Privacy</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
