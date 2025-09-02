// src/components/SiteHeader.jsx
import React from "react";
import { Sun, Moon, Globe, BarChart3 } from "lucide-react";
import { useLocale } from "../state/LocaleContext.jsx";

export default function SiteHeader({
  theme,
  onToggleTheme,
  locale: localeProp,
  setLocale: setLocaleProp,
  hideStats = false, // Hide Stats button when true
}) {
  const { locale: ctxLocale, setLocale: ctxSetLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const setLocale = setLocaleProp ?? ctxSetLocale;

  const [internalTheme, setInternalTheme] = React.useState(
    () => document.documentElement.getAttribute("data-theme") || "light"
  );
  const [isLangDropdownOpen, setIsLangDropdownOpen] = React.useState(false);
  const currentTheme = theme ?? internalTheme;
  const toggleTheme =
    onToggleTheme ??
    (() => {
      const next = currentTheme === "light" ? "dark" : "light";
      setInternalTheme(next);
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });

  const stackedLogoSrc =
    (currentTheme || "").toLowerCase() === "dark"
      ? "/logo/merge-logo-wide-dark.png"
      : "/logo/merge-logo-wide-light.png";

  return (
    <header className="siteHeader fullbleed-edge">
      <div className="headerInner">
        {/* Brand (link home) */}
        <a href="/" className="brand" aria-label="Merge PDF — Home">
          {/* Light logo */}
          <img
            src="/logo/merge-logo-wide-light.png"
            className="brandImg logo-light"
            alt="Merge PDF logo"
            height={40}
          />
          {/* Dark logo */}
          <img
            src="/logo/merge-logo-wide-dark.png"
            className="brandImg logo-dark"
            alt="Merge PDF logo"
            height={40}
          />
          {/* Accessible name for SEO/screen readers; visually hidden */}
          <span style={{
            position:'absolute', width:1, height:1, margin:-1, padding:0,
            overflow:'hidden', clip:'rect(0 0 0 0)', border:0
          }}>Merge PDF</span>
        </a>


        <div className="headerRight">
          {/* Stats Link - Show text on desktop, icon only on mobile */}
          {!hideStats && (
            <a 
              href="#stats" 
              className="statsLink" 
              aria-label="View statistics"
              onClick={(e) => {
                e.preventDefault();
                const statsSection = document.getElementById('stats');
                if (statsSection) {
                  statsSection.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                  });
                }
              }}
            >
              <BarChart3 size={16} aria-hidden />
              <span className="statsLinkText">Stats</span>
            </a>
          )}

          {/* Language Selector - Desktop dropdown, mobile button */}
          <div 
            className={`langWrap ${isLangDropdownOpen ? 'langDropdownOpen' : ''}`} 
            aria-label="Change language"
          >
            {/* Desktop: Full dropdown */}
            <div className="langSelectWrapper">
              <select
                className="langSelect"
                value={locale}
                onChange={(e) => {
                  setLocale?.(e.target.value);
                  setIsLangDropdownOpen(false);
                }}
                onBlur={() => setIsLangDropdownOpen(false)}
              >
                <option value="en">EN</option>
                <option value="af">AF</option>
                <option value="zu">ZU</option>
                <option value="xh">XH</option>
              </select>
              <Globe size={16} className="langGlobeIcon" />
            </div>
            
            {/* Mobile: Language button */}
            <button
              className="langButton"
              onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
              aria-label={`Current language: ${locale.toUpperCase()}. Click to change.`}
            >
              <Globe size={18} className="langIcon" aria-hidden />
            </button>
          </div>

          <button
            className="themeToggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${currentTheme === "light" ? "dark" : "light"} mode`}

          >
            <span className="themeIcon">
              {currentTheme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </span>
            <span className="toggleLabel">
              {currentTheme === "light" ? "Dark" : "Light"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
