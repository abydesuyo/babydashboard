# MongoDB Atlas + Cloudflare Pages Setup Guide

This guide will help you set up MongoDB Atlas with Cloudflare Pages Functions for persistent sheet storage.

> **⚠️ Deprecation Notice**: `realm-web` SDK is deprecated as of September 2024 and will reach end-of-life on September 30, 2025. This implementation will work until then. For future-proofing, consider migrating to a traditional Node.js backend with MongoDB native driver after this date.

## 🏁 Quick Setup (15 minutes)

### Step 1: Create MongoDB Atlas Account (Free)

1. **Sign up** at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. **Create a free M0 cluster:**
   - Choose cloud provider (AWS recommended)
   - Select free tier (M0 Sandbox)
   - Choose region closest to your users
   - Name your cluster (e.g., "baby-dashboard-cluster")

### Step 2: Set Up Database Access

1. **Create Database User:**
   - Go to Database Access → Add New Database User
   - Username: `baby-dashboard-user` (or any name)
   - Password: Generate secure password (save this!)
   - Database User Privileges: "Atlas admin"

2. **Configure Network Access:**
   - Go to Network Access → Add IP Address
   - Add `0.0.0.0/0` (Allow access from anywhere - needed for Cloudflare)
   - This is safe because we use API key authentication

### Step 3: Create App Service (for Realm SDK)

1. **Create App Service:**
   - Go to App Services → Create a New App
   - Choose "Build your own App"
   - Name: `baby-dashboard-app`
   - Link to your cluster
   - Choose region

2. **Enable API Key Authentication:**
   - In App Services → Authentication → Authentication Providers
   - Enable "API Keys"
   - Save Draft → Review & Deploy

3. **Create API Key:**
   - Authentication → API Keys → Create API Key
   - Name: `cloudflare-pages-key`
   - **Save the API key immediately** (shown only once!)

4. **Set up Database Rules:**
   - App Services → Rules → Add Collection Rule
   - Database: `baby-dashboard`
   - Collection: `users`
   - Template: "Users can only read and write their own data"
   - Filter: `{ "email": "%%user.custom_data.email" }`
   - 
   - Repeat for `user_sheets` collection
   - Save Draft → Review & Deploy

### Step 4: Configure Cloudflare Pages

1. **Add Environment Variables** in Cloudflare Pages dashboard:
   ```
   MONGODB_APP_ID = your-app-service-id (from App Service URL)
   MONGODB_API_KEY = your-api-key-from-step-3
   ```

2. **Get App Service ID:**
   - In MongoDB App Services, go to your app
   - Copy the App ID from the URL or settings page
   - Format: `baby-dashboard-app-xxxxx`

### Step 5: Install Dependencies

Run in your project directory:
```bash
npm install realm-web
```

### Step 6: Deploy and Test

1. **Commit and push** your code to trigger Cloudflare Pages deployment
2. **Test the API** by visiting: `https://your-domain.pages.dev/api/health`
3. **Check logs** in Cloudflare Pages dashboard if needed

## 🗄️ Database Schema

Your MongoDB will automatically create these collections:

### `users` Collection
```javascript
{
  _id: ObjectId,
  email: "user@example.com",
  name: "John Doe",
  pictureUrl: "https://...",
  createdAt: Date,
  updatedAt: Date
}
```

### `user_sheets` Collection
```javascript
{
  _id: ObjectId,
  userEmail: "user@example.com",
  sheetId: "user-123-456789",
  sheetName: "Baby Emma - Family",
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  role: "owner", // or "collaborator"
  createdBy: "user@example.com",
  lastAccessed: Date,
  createdAt: Date
}
```

## 🔍 API Endpoints

Your Cloudflare Pages will serve these endpoints:

- `GET /api/health` - Health check and connection status
- `GET /api/sheets` - Get user's saved sheets  
- `POST /api/sheets` - Save a new sheet
- `PUT /api/sheets/{id}/access` - Update last accessed time
- `DELETE /api/sheets/{id}` - Remove sheet from user's collection

## 🐛 Troubleshooting

### Connection Issues
1. **Check environment variables** in Cloudflare Pages dashboard
2. **Verify App Service deployment** - must be deployed, not just drafted
3. **Check API key** - ensure it's correctly copied (no extra spaces)

### Authentication Issues  
1. **Verify Google OAuth token** is being sent correctly
2. **Check CORS settings** if requests are blocked
3. **Review Cloudflare Pages function logs**

### Database Issues
1. **Verify cluster is running** (M0 free tier)
2. **Check network access** includes `0.0.0.0/0`
3. **Ensure database user has admin privileges**

## 💰 Cost Breakdown

- **MongoDB Atlas M0**: FREE (512MB storage)
- **Cloudflare Pages Functions**: FREE (100k requests/day)
- **Total monthly cost**: $0 for typical usage

## 🔒 Security Notes

- API endpoints require Google OAuth token
- MongoDB uses API key authentication (not database credentials)
- Network access is open but protected by App Service authentication
- User data is isolated by email address

## 📈 Scaling

When you outgrow the free tier:
- **M2 Cluster**: $9/month (2GB storage)
- **M5 Cluster**: $25/month (5GB storage)
- Cloudflare Pages remains free for most usage

Your setup will handle thousands of users before needing to upgrade!