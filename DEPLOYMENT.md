# Production Deployment Guide (Future‑Proof)

This project uses:
- Frontend: React (Vite) on Cloudflare Pages
- Backend: Node/Express (MongoDB native driver) on a Node host (Railway/Render)
- Database: MongoDB Atlas (no deprecated SDKs)

## 1) Prerequisites
- MongoDB Atlas cluster (SRV URI working)
- GitHub repository connected
- Node 18+ on CI hosts

## 2) Backend Deployment (Railway or Render)

Recommended: Railway (similar steps apply to Render)

- Service root: backend
- Build command: `npm install`
- Start command: `npm start`
- Environment variables (set in platform dashboard):
  - `MONGODB_URI` (Atlas SRV connection string)
  - `NODE_ENV=production`
  - `ALLOWED_ORIGINS=https://<your-pages>.pages.dev,https://<your-custom-domain>`
  - `RATE_LIMIT_WINDOW_MS=900000`
  - `RATE_LIMIT_MAX_REQUESTS=100`
- Verify after deploy:
  - `GET https://<backend>/api/health` → healthy JSON
  - `GET https://<backend>/api` → endpoints JSON

Render differences:
- Create Web Service → Point to backend directory
- Build: `npm install`, Start: `npm start`
- Add same environment variables

MongoDB Atlas tips:
- Network Access: allow your host (0.0.0.0/0 is okay to start, tighten later)
- Strong DB user password and least privilege where possible

## 3) Frontend Deployment (Cloudflare Pages with Wrangler)

- One-time login: `npx wrangler login`
- Build locally: `npm ci && npm run build`
- Deploy: `npx wrangler pages deploy dist --project-name <pages-project>`
- In Pages → Settings → Environment Variables (Production):
  - `VITE_API_URL=https://<your-backend-hostname>`
- In Pages → Settings → Build & Deploy:
  - Production branch: `version2` (or your chosen prod branch)
- Pages Functions: if not using them here, disable or remove/rename the `/functions` directory to avoid intercepting `/api` routes.

Alternative (no CLI):
- Use Cloudflare Pages UI → Connect to GitHub → set Build command `npm run build`, Output `dist`, Production branch `version2`.

## 4) Environment Variables Summary
- Backend (Railway/Render):
  - `MONGODB_URI`, `NODE_ENV`, `ALLOWED_ORIGINS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`
- Frontend (Cloudflare Pages):
  - `VITE_API_URL` → points to your backend base URL

## 5) Local Development
- From repo root:
  - Backend: `cd backend && npm run dev`
  - Frontend: `npm run dev`
  - Or both: `npm run start:all`
- Frontend dev API base: defaults to `http://localhost:3001` (no need to set env)

## 6) Branching Strategy (v1 vs version2)
- Create branches:
  - `v1` (legacy)
  - `version2` (production)
- Protect branches in GitHub to prevent accidental merges
- Deploy backend and Pages from `version2`
- Optionally run a second backend service from `v1` if you need legacy live

## 7) Smoke Tests (Post‑Deploy)
- Backend:
  - `GET /api/health` → `{ status: 'healthy', mongodb: 'connected', ... }`
  - `GET /api` → lists endpoints
- Frontend:
  - Open Pages URL → DevTools → Network → `/api/*` requests point to your backend domain and return JSON
  - Unauthenticated `/api/sheets` returns 401 JSON (expected)

## 8) Troubleshooting
- CORS errors: ensure `ALLOWED_ORIGINS` includes your Pages domains (and local dev)
- HTML response parsed as JSON (Unexpected token '<'):
  - Check `VITE_API_URL` in Pages; ensure requests target backend domain
  - Confirm `/api/*` exists on backend and responds JSON
- Mongo connection errors:
  - Verify Atlas URI and Network Access (IP allowlist)
  - Ensure host can resolve Atlas DNS (no blocked SRV)
- 401 from `/api/sheets` during app usage:
  - Frontend must send headers: `Authorization: Bearer <token>`, `X-User-Email: <email>`

## 9) Rollback
- Backend: redeploy previous commit on Railway/Render
- Frontend: Pages → Deployments → “Redeploy” previous build or switch Production branch

---

## All‑Cloudflare (Free) Option

Move the backend to Cloudflare Pages Functions and call MongoDB Atlas via the Data API.

- What changes:
  - Use handlers in `/functions` for `/api/*` (already added: health, sheets list/save, update access)
  - No native MongoDB driver; use Atlas Data API via env bindings
  - Delete endpoint is not exposed (by design)
- Required Pages env vars (Production):
  - `DATA_API_URL` → e.g. `https://data.mongodb-api.com/app/<AppID>/endpoint/data/v1/action`
  - `DATA_API_KEY` → Atlas App Services Data API key
  - `DATA_SOURCE` → your cluster name (e.g., `Cluster0`)
  - `DB_NAME` → `baby-dashboard`
- Auth in Functions:
  - Client sends Google access token as `Authorization: Bearer <token>`
  - Functions validate token via Google UserInfo and derive `email` server‑side (don’t trust client headers)
- Deploy with Wrangler:
  - `npx wrangler login`
  - `npm run build`
  - `npx wrangler pages deploy dist --project-name <pages-project>`
- Frontend config in prod:
  - Do not set `VITE_API_URL` so the client uses same‑origin `/api`
- Local dev for Functions:
  - `npx wrangler pages dev dist --binding DATA_API_URL=... --binding DATA_API_KEY=... --binding DATA_SOURCE=Cluster0 --binding DB_NAME=baby-dashboard`

This achieves a $0/month, always‑on stack entirely on Cloudflare + Atlas free tiers.