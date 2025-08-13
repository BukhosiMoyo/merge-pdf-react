# Compress PDF — Monorepo

## Apps
- `apps/compress-pdf-react` — Frontend (React + Vite)
- `packages/backend`       — API (Node/Express)

## Dev
cd apps/compress-pdf-react && npm install && npm run dev
cd packages/backend && npm install && npm run dev

## Build
cd apps/compress-pdf-react && npm run build

## Env
- Frontend: Vercel env `VITE_API_BASE=https://api.compresspdf.co.za`
- Backend:  `.env` on server (see backend README)
