// src/components/GlobalSchema.jsx
import React from "react";

export default function GlobalSchema() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Merge PDF",
      "url": "https://mergepdf.co.za/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://mergepdf.co.za/?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Merge PDF",
      "url": "https://mergepdf.co.za/",
      "logo": "https://mergepdf.co.za/merge-logo-wide-light.svg",   // light version is fine for logo URL
      "sameAs": []
    }
  ];

  return (
    <script
      type="application/ld+json"
      // stringifying an array is valid; Google reads multi-nodes fine
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
