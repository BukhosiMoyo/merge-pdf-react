// src/components/SiteHeader.jsx
import React from "react";
import { Sun, Moon, Globe } from "lucide-react";
import { useLocale } from "../state/LocaleContext.jsx";

export default function SiteHeader({
  theme,
  onToggleTheme,
  locale: localeProp,
  setLocale: setLocaleProp,
}) {
  const { locale: ctxLocale, setLocale: ctxSetLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const setLocale = setLocaleProp ?? ctxSetLocale;

  const [internalTheme, setInternalTheme] = React.useState(
    () => document.documentElement.getAttribute("data-theme") || "light"
  );
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
    <header className="siteHeader">
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
          <label className="langWrap" aria-label="Change language">
            <Globe size={16} aria-hidden />
            <select
              className="langSelect"
              value={locale}
              onChange={(e) => setLocale?.(e.target.value)}
            >
              <option value="en">EN</option>
              <option value="af">AF</option>
              <option value="zu">ZU</option>
              <option value="xh">XH</option>
            </select>
          </label>

          <button
            type="button"
            className="themeToggle"
            onClick={toggleTheme}
            title={currentTheme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {currentTheme === "light" ? <Sun size={16} /> : <Moon size={16} />}
            <span className="toggleLabel">{currentTheme === "light" ? "Dark" : "Light"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
