// src/components/Seo.jsx
import { useEffect } from "react";

const SITE_NAME = "Merge PDF";
const DEFAULT_OG_IMAGE = "/og-image.jpg"; // You can add this later

export default function Seo({ 
  title, 
  description, 
  canonicalPath, 
  noindex = false 
}) {
  useEffect(() => {
    // Get site URL from environment or fallback
    const siteUrl = import.meta.env.VITE_SITE_BASE || window.location.origin;
    const isLocalhost = siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1');
    
    // Set document title
    document.title = title;
    
    // Remove existing meta tags we manage
    const existingDescription = document.querySelector('meta[name="description"]');
    const existingCanonical = document.querySelector('link[rel="canonical"]');
    const existingRobots = document.querySelector('meta[name="robots"]');
    
    if (existingDescription) existingDescription.remove();
    if (existingCanonical) existingCanonical.remove();
    if (existingRobots) existingRobots.remove();
    
    // Create and append new meta tags
    const head = document.head;
    
    // Description meta tag
    const descriptionMeta = document.createElement('meta');
    descriptionMeta.name = 'description';
    descriptionMeta.content = description;
    head.appendChild(descriptionMeta);
    
    // Canonical link (only if not localhost and canonicalPath provided)
    if (!isLocalhost && canonicalPath) {
      const canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      canonicalLink.href = `${siteUrl}${canonicalPath}`;
      head.appendChild(canonicalLink);
    }
    
    // Robots meta tag
    const robotsMeta = document.createElement('meta');
    robotsMeta.name = 'robots';
    robotsMeta.content = noindex ? 'noindex, nofollow' : 'index, follow';
    head.appendChild(robotsMeta);
    
    // Open Graph tags
    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME }
    ];
    
    if (!isLocalhost && canonicalPath) {
      ogTags.push({ property: 'og:url', content: `${siteUrl}${canonicalPath}` });
    }
    
    ogTags.forEach(tag => {
      const existing = document.querySelector(`meta[property="${tag.property}"]`);
      if (existing) existing.remove();
      
      const meta = document.createElement('meta');
      meta.setAttribute('property', tag.property);
      meta.content = tag.content;
      head.appendChild(meta);
    });
    
    // Twitter Card tags
    const twitterTags = [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description }
    ];
    
    twitterTags.forEach(tag => {
      const existing = document.querySelector(`meta[name="${tag.name}"]`);
      if (existing) existing.remove();
      
      const meta = document.createElement('meta');
      meta.name = tag.name;
      meta.content = tag.content;
      head.appendChild(meta);
    });
    
    // Cleanup function to remove tags when component unmounts
    return () => {
      // Note: We don't remove tags on unmount to avoid flickering
      // The next page's Seo component will handle cleanup
    };
  }, [title, description, canonicalPath, noindex]);
  
  return null; // This component doesn't render anything
}
