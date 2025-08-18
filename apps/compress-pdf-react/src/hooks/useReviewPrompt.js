// src/hooks/useReviewPrompt.js
const KEY = "cpdf.review"; // { ratedAt?: ISO, lastAskAt?: ISO }

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
};
const write = (obj) => localStorage.setItem(KEY, JSON.stringify(obj));

export function useReviewPrompt() {
  const DAY = 24 * 60 * 60 * 1000;

  function shouldAsk() {
    const s = read();
    if (s.ratedAt) return false;                 // already reviewed
    const last = s.lastAskAt ? Date.parse(s.lastAskAt) : 0;
    return Date.now() - last > DAY;              // ask at most once/day
  }

  function markAsked() {
    const s = read();
    s.lastAskAt = new Date().toISOString();
    write(s);
  }

  function markRated(stars) {
    const s = read();
    s.ratedAt = new Date().toISOString();
    s.stars = stars;
    write(s);
  }

  return { shouldAsk, markAsked, markRated };
}
