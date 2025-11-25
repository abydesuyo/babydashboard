# Baby Dashboard API - Node.js Backend

Future-proof Node.js backend with MongoDB native driver (no deprecated dependencies).

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB Atlas connection string
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Run production server:**
   ```bash
   npm start
   ```

## Environment Variables

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/baby-dashboard?retryWrites=true&w=majority
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.pages.dev
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/health` - Health check (REST alias)
- `GET /api/sheets` - Get user's saved sheets
- `POST /api/sheets` - Save or update a sheet association
- `PUT /api/sheets/:id/access` - Update last accessed time

## Deployment

### Railway
1. Connect GitHub repo to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Render
1. Connect GitHub repo to Render
2. Set environment variables in Render dashboard  
3. Deploy automatically on push

## Database Schema

### users collection
```javascript
{
  _id: ObjectId,
  email: "user@example.com", 
  createdAt: Date,
  updatedAt: Date
}
```

### user_sheets collection
```javascript
{
  _id: ObjectId,
  userEmail: "user@example.com",
  sheetId: "user-123-456789",
  sheetName: "Baby Emma - Family", 
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  role: "owner",
  createdBy: "user@example.com",
  lastAccessed: Date,
  createdAt: Date
}
```