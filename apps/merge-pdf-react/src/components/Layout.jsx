import React from "react";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";

/**
 * Layout: shared shell for all pages.
 * Props:
 *  - headerProps: { theme, onToggleTheme }     // locale handled by context
 *  - children: page content
 *  - footerProps: optional
 */
export default function Layout({ headerProps, children, footerProps }) {
  return (
    <div className="pageWrap">
      <SiteHeader {...headerProps} />
      <main className="pageMain">{children}</main>
      <SiteFooter {...footerProps} />
    </div>
  );
}
