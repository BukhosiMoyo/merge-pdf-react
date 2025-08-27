import React from "react";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import GlobalSchema from "./GlobalSchema.jsx"; // ← add this

export default function Layout({ headerProps, children, footerProps }) {
  return (
    <div className="pageWrap">
      <SiteHeader {...headerProps} />
      <main className="pageMain">{children}</main>
      <SiteFooter {...footerProps} />
      <GlobalSchema /> {/* ← inject once, globally */}
    </div>
  );
}
