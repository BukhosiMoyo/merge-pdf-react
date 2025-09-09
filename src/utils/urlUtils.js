// URL utility functions to ensure all API URLs are absolute

/**
 * Converts a relative or absolute URL to an absolute API URL
 * @param {string} url - The URL to absolutize (can be relative or absolute)
 * @returns {string} - Absolute URL pointing to the API
 */
export function absolutizeApiUrl(url) {
  if (!url) return '';
  
  // If already absolute, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Get API base URL
  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
  const base = apiBase.replace(/\/+$/, ''); // Remove trailing slashes
  
  // Ensure URL starts with /
  const path = url.startsWith('/') ? url : `/${url}`;
  
  return `${base}${path}`;
}

/**
 * Checks if a URL is absolute
 * @param {string} url - The URL to check
 * @returns {boolean} - True if absolute, false if relative
 */
export function isAbsoluteUrl(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}
