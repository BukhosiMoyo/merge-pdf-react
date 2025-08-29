// src/components/StatsAndFAQ.jsx
import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function useStats() {
  const [count, setCount] = useState(null);
  useEffect(() => {
    let alive = true;
    console.log("🔍 Stats: Starting API call to:", `${API}/v1/merge-pdf/stats`);
    (async () => {
      try {
        const r = await fetch(`${API}/v1/merge-pdf/stats`, { credentials: "include" });
        console.log("🔍 Stats: Response status:", r.status, r.ok);
        const j = await r.json().catch(() => ({}));
        console.log("🔍 Stats: Response data:", j);
        if (alive && j?.total_merged != null) {
          console.log("🔍 Stats: Setting count to:", j.total_merged);
          setCount(j.total_merged);
        } else {
          console.log("🔍 Stats: No total_merged in response");
        }
      } catch (error) {
        console.error("🔍 Stats: Error:", error);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return count;
}

function useReviews() {
  const [agg, setAgg] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API}/v1/merge-pdf/reviews`, { credentials: "include" });
        const j = await r.json().catch(() => ({}));
        if (alive && j?.reviewCount != null) {
          setAgg({
            count: j.reviewCount,
            rating: Number(j.ratingValue || 0),
          });
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return agg;
}

function FAQSchema({ faqs, agg }) {
  const json = useMemo(() => {
    const nodes = [];
    if (faqs?.length) {
      nodes.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      });
    }
    if (agg && agg.count > 0) {
      nodes.push({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Merge PDF",
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: agg.rating,
          reviewCount: agg.count,
        },
      });
    }
    return nodes.length === 0 ? null : JSON.stringify(nodes.length === 1 ? nodes[0] : nodes);
  }, [faqs, agg]);

  if (!json) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export default function StatsAndFAQ() {
  console.log("🔍 StatsAndFAQ: Component rendering, API =", API);
  const total = useStats();
  const agg = useReviews();
  console.log("🔍 StatsAndFAQ: total =", total, "agg =", agg);

  // Cool animated stats
  const [animatedTotal, setAnimatedTotal] = useState(0);
  const [animatedRating, setAnimatedRating] = useState(0);

  useEffect(() => {
    if (total !== null) {
      const timer = setTimeout(() => setAnimatedTotal(total), 100);
      return () => clearTimeout(timer);
    }
  }, [total]);

  useEffect(() => {
    if (agg?.rating) {
      const timer = setTimeout(() => setAnimatedRating(agg.rating), 200);
      return () => clearTimeout(timer);
    }
  }, [agg?.rating]);

  const faqs = [
    {
      q: "How do I merge PDF files?",
      a: "Click \"Select PDF files\" (or drag & drop), arrange them in the order you want, then click Merge. We'll combine them into one PDF you can download instantly.",
    },
    {
      q: "Is there a file size or number limit?",
      a: "You can add up to 20 PDFs per merge with a per‑file limit of ~20MB (exact limits may vary). If a file is too large, compress it first, then merge.",
    },
    {
      q: "Do you change my original PDFs?",
      a: "No. Your original files stay intact on your device. We only create a merged output for you to download.",
    },
    {
      q: "Is this tool free?",
      a: "Yes. You can merge PDFs for free. We may add premium features in future, but merging stays free.",
    },
    {
      q: "Is my data secure?",
      a: "Files are processed over HTTPS. Temporary outputs are auto‑deleted after a short time‑to‑live to protect your privacy.",
    },
    {
      q: "Will the merged PDF keep my page quality?",
      a: "Yes. We simply combine pages without re‑rendering them, so page quality is preserved.",
    },
    {
      q: "Can I change the order before merging?",
      a: "Absolutely. Drag tiles to reorder, sort A↕Z, or restore your original order before merging.",
    },
    {
      q: "Do you support mobile?",
      a: "Yes. The tool works on modern mobile browsers. For best results, use the latest Chrome, Safari, or Edge.",
    },
    {
      q: "Why can't I upload my file?",
      a: "Ensure the file is a PDF and under the size limit. If it still fails, try renaming the file or re‑saving it as a standard PDF.",
    },
    {
      q: "Where can I report an issue?",
      a: "Please use the site's contact link or support email. Include screenshots and steps so we can help quickly.",
    },
  ];

  // keep details aria attrs in sync for screen readers
  function handleToggle(e) {
    const details = e.currentTarget;
    const open = !!details.open;
    const summary = details.querySelector("summary");
    const region = details.querySelector(".faqA");
    if (summary) summary.setAttribute("aria-expanded", String(open));
    if (region) region.setAttribute("aria-hidden", String(!open));
  }

  return (
    <>
             {/* Total Counter - Back at the top */}
       <section className="totalPdfsCounter" aria-label="Total merged PDFs">
         <div className="counterTitle">Total merged PDFs</div>
         <div className="counterPeel" role="status" aria-live="polite">
           {total == null ? "…" : animatedTotal.toLocaleString()}
         </div>
       </section>

      {/* FAQs Section - Now Second */}
      <section className="faqWrap" aria-label="Frequently Asked Questions">
        <h2 className="faqTitle">Frequently Asked Questions</h2>
        <div className="faqList">
          {faqs.map(({ q, a }, i) => (
            <details
              key={i}
              className="faqItem"
              role="group"
              aria-labelledby={`faq-${i}`}
              onToggle={handleToggle}
            >
                                             <summary id={`faq-${i}`} className="faqQ" aria-expanded="false">
                  <span className="faqQText">{q}</span>
                  <span className="faqChevron" aria-hidden="true"></span>
                </summary>
              <div className="faqA" role="region" aria-hidden="true">
                {a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Stats Section - Now Below FAQs */}
      <section id="stats" className="statsSection" aria-label="Performance Statistics">
        <h2 className="statsTitle">Performance Statistics</h2>
        
        {/* Enhanced Stats Grid - 2x2 Layout */}
        <div className="statsGrid">
          <div className="statCard">
            <div className="statIcon">📊</div>
            <div className="statValue">{total == null ? "…" : animatedTotal.toLocaleString()}</div>
            <div className="statLabel">Total Merged</div>
          </div>
          
          <div className="statCard">
            <div className="statIcon">⚡</div>
            <div className="statValue">99.8%</div>
            <div className="statLabel">Success Rate</div>
          </div>
          
          <div className="statCard">
            <div className="statIcon">🚀</div>
            <div className="statValue">~2s</div>
            <div className="statLabel">Avg. Speed</div>
          </div>
          
          <div className="statCard">
            <div className="statIcon">🔒</div>
            <div className="statValue">100%</div>
            <div className="statLabel">Secure</div>
          </div>
        </div>
      </section>

      {/* User Reviews Section - Simplified and Improved */}
      {agg && agg.count > 0 && (
        <section className="reviewsSection" aria-label="User Reviews">
          <div className="reviewsContainer">
            <div className="reviewsHeader">
              <div className="ratingDisplay">
                <div className="ratingStars">
                  {[...Array(5)].map((_, i) => (
                    <span 
                      key={i} 
                      className={`star ${i < Math.floor(animatedRating) ? 'filled' : ''}`}
                      style={{ color: i < animatedRating ? '#FFD700' : '#6b7280' }}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <div className="ratingText">
                  <span className="ratingValue">{animatedRating.toFixed(1)}</span>
                  <span className="ratingCount">rated by {agg.count} people</span>
                </div>
              </div>
            </div>
            
            <div className="reviewsSummary">
              <p className="reviewsDescription">
                Join thousands of satisfied users who trust our PDF merging tool for their document needs.
              </p>
            </div>
          </div>
        </section>
      )}

      <FAQSchema faqs={faqs} agg={agg} />
    </>
  );
}
