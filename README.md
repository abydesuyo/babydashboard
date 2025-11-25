# Baby Activity Dashboard

React + TypeScript (Vite) frontend with a Node.js (Express) backend and MongoDB Atlas.

- Frontend: `src/` (Vite) → deploy to Cloudflare Pages
- Backend: `backend/` (Express + MongoDB) → deploy to Railway/Render
- Types and utilities in `src/types` and `src/utils`

## Local Development

- Backend:
  ```bash
  cd backend
  npm install
  npm run dev
  ```
- Frontend (in another terminal):
  ```bash
  npm install
  npm run dev
  ```
- Or both at once from project root:
  ```bash
  npm run start:all
  ```

## Production Deployment

- Full guide: see `DEPLOYMENT.md`
- Backend details: see `backend/README.md`

## Environment

- Frontend (dev): defaults to `http://localhost:3001` for API
- Frontend (prod): set `VITE_API_URL` to your backend URL in Cloudflare Pages
- Backend: set `MONGODB_URI`, `ALLOWED_ORIGINS`, etc. in your host (Railway/Render)

## API

- Health: `GET /api/health`
- Sheets: `GET/POST /api/sheets`
- Update Access: `PUT /api/sheets/:id/access`

## Notes

- No deprecated SDKs (uses MongoDB native driver on backend)
- Keep the `/functions` directory disabled or removed if not using Cloudflare Pages Functions
