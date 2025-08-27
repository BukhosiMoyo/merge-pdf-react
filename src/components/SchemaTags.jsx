import React, { useMemo } from "react";

/**
 * SchemaTags
 * Props:
 *  - faqs: [{ q, a }]
 *  - reviews: { rating: number, count: number }
 *  - page: { url, name }                       // canonical page info
 *  - org:  { name, url, logo }                 // used once globally or per page
 *  - app:  { name, url, logo, brandColor }     // WebApplication metadata
 * Notes:
 *  - Only render schema that matches visible content on the page.
 *  - Google prefers a single <script type="application/ld+json">, but accepts an array.
 */
export default function SchemaTags({ faqs = [], reviews, page, org, app }) {
  const json = useMemo(() => {
    const nodes = [];

    // WebApplication (attach AggregateRating if present)
    if (app?.name && app?.url) {
      const webApp = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "@id": `${app.url}#app`,
        name: app.name,
        url: app.url,
        image: app.logo ? [app.logo] : undefined,
        operatingSystem: "Web",
        applicationCategory: "UtilityApplication",
        // Make the “free” nature explicit:
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        isAccessibleForFree: true,
      };
      if (reviews?.count > 0 && reviews?.rating > 0) {
        webApp.aggregateRating = {
          "@type": "AggregateRating",
          ratingValue: Number(reviews.rating).toFixed(1),
          ratingCount: Number(reviews.count),
        };
      }
      nodes.push(webApp);
    }

    // FAQ block (only if FAQs are actually shown on this page)
    if (faqs.length) {
      nodes.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": `${page?.url || app?.url || ""}#faq`,
        mainEntity: faqs.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      });
    }

    // Organization + WebSite (optional, safe context)
    if (org?.name && org?.url) {
      nodes.push({
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${org.url}#org`,
        name: org.name,
        url: org.url,
        logo: org.logo ? { "@type": "ImageObject", url: org.logo } : undefined,
      });
    }
    if (org?.url) {
      nodes.push({
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${org.url}#website`,
        url: org.url,
        name: app?.name || org?.name || "Merge PDF",
        inLanguage: "en",
      });
    }

    if (!nodes.length) return null;
    return JSON.stringify(nodes.length === 1 ? nodes[0] : nodes);
  }, [faqs, reviews, page, org, app]);

  if (!json) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
