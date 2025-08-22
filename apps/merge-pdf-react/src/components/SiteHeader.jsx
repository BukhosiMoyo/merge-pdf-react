import React from "react";
import { Sun, Moon, Globe } from "lucide-react";
import { useLocale } from "../state/LocaleContext.jsx";

/**
 * SiteHeader reads locale from context by default.
 * If `locale`/`setLocale` are passed via props, those win.
 * Theme can be controlled via props or it will manage itself.
 */
export default function SiteHeader({
  theme,
  onToggleTheme,
  locale: localeProp,
  setLocale: setLocaleProp,
}) {
  // Locale (context as default)
  const { locale: ctxLocale, setLocale: ctxSetLocale, t } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const setLocale = setLocaleProp ?? ctxSetLocale;

  // Theme (self-manage if not provided)
  const [internalTheme, setInternalTheme] = React.useState(() => {
    return document.documentElement.getAttribute("data-theme") || "light";
  });
  const currentTheme = theme ?? internalTheme;
  const toggleTheme =
    onToggleTheme ??
    (() => {
      const next = currentTheme === "light" ? "dark" : "light";
      setInternalTheme(next);
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });

  return (
    <header className="siteHeader">
      <div className="headerInner">
        {/* Brand (link home) */}
        <a href="/" className="brand" aria-label="Merge PDF — Home">
          <div className="brandMark">M</div>
          <div>Match PDF</div> {/* <- stays fixed, per your request */}
        </a>


        <div className="headerRight">
          {/* Language */}
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

          {/* Theme toggle */}
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
