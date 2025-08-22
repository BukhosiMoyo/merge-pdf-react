#!/usr/bin/env bash
set -euo pipefail

# Run from repo root: ~/tools-suite
echo "Committing app changes…"
git add apps/merge-pdf-react
git commit -m "Update merge-pdf-react app" || echo "No changes to commit."

echo "Rebuilding subtree branch…"
git branch -D publish/merge-pdf-react 2>/dev/null || true
git subtree split --prefix=apps/merge-pdf-react -b publish/merge-pdf-react

echo "Pushing to GitHub repo (main)…"
git push -f https://github.com/BukhosiMoyo/merge-pdf-react.git publish/merge-pdf-react:main
echo "Done."
