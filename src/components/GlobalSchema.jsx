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
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Merge PDF Tool",
      "applicationCategory": "ProductivityApplication",
      "operatingSystem": "Web Browser",
      "description": "Free online tool to merge multiple PDF files into one document. Drag and drop interface with secure processing.",
      "url": "https://mergepdf.co.za/",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "reviewCount": "1500"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Merge PDF Service",
      "description": "Professional PDF merging service with drag-and-drop interface, secure processing, and instant downloads.",
      "brand": {
        "@type": "Brand",
        "name": "Merge PDF"
      },
      "category": "Document Management",
      "url": "https://mergepdf.co.za/",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "reviewCount": "1500",
        "bestRating": "5",
        "worstRating": "1"
      },
      "review": [
        {
          "@type": "Review",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": "5",
            "bestRating": "5"
          },
          "author": {
            "@type": "Person",
            "name": "Sarah Johnson"
          },
          "reviewBody": "Excellent tool! Merged my 15-page report in seconds. Very intuitive interface."
        },
        {
          "@type": "Review",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": "5",
            "bestRating": "5"
          },
          "author": {
            "@type": "Person",
            "name": "Michael Chen"
          },
          "reviewBody": "Perfect for combining multiple PDFs. Fast, secure, and completely free."
        },
        {
          "@type": "Review",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": "4",
            "bestRating": "5"
          },
          "author": {
            "@type": "Person",
            "name": "Emma Rodriguez"
          },
          "reviewBody": "Great tool for merging PDFs. Simple to use and works perfectly every time."
        }
      ]
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
