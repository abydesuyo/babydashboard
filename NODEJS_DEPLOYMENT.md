# Future-Proof Node.js Backend Deployment Guide

Your baby dashboard now uses a future-proof Node.js backend with MongoDB native driver (no deprecated dependencies!).

## 🚀 Quick Deployment Options

### Option 1: Railway (Recommended - Easiest)

1. **Create Railway account** at [railway.app](https://railway.app)
2. **Connect GitHub** and select your repo
3. **Select backend folder** during deployment
4. **Add environment variables** in Railway dashboard:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/baby-dashboard?retryWrites=true&w=majority
   NODE_ENV=production
   ALLOWED_ORIGINS=https://your-domain.pages.dev,http://localhost:5173
   ```
5. **Deploy automatically** - Railway will detect Node.js and deploy

### Option 2: Render

1. **Create Render account** at [render.com](https://render.com)
2. **Connect GitHub** repo
3. **Create Web Service** with these settings:
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`
   - Environment: Node
4. **Add environment variables** (same as Railway)

### Option 3: Vercel (Functions)

1. **Install Vercel CLI**: `npm i -g vercel`
2. **Deploy**: `cd backend && vercel`
3. **Set environment variables** in Vercel dashboard

## 🔧 Environment Configuration

**Required Environment Variables:**
```bash
MONGODB_URI=your-mongodb-connection-string
NODE_ENV=production
ALLOWED_ORIGINS=https://your-cloudflare-pages-domain.pages.dev
PORT=3001  # Optional, platform will set automatically
RATE_LIMIT_WINDOW_MS=900000  # Optional
RATE_LIMIT_MAX_REQUESTS=100  # Optional
```

## 📝 Frontend Configuration

**Update your frontend to use the new backend:**

1. **Add backend URL** to your Cloudflare Pages environment variables:
   ```
   VITE_API_URL=https://your-backend-domain.railway.app
   ```

2. **The frontend is already configured** to work with the Node.js backend

## 🏃‍♂️ Local Development

**Run backend locally:**
```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB connection string
npm run dev
```

**Frontend will automatically use** `http://localhost:3001` when VITE_API_URL is not set.

## 🔍 Testing Your Deployment

1. **Health Check**: Visit `https://your-backend-url/health`
   - Should return: `{"status":"healthy","mongodb":"connected","timestamp":"..."}`

2. **API Test**: Your frontend will automatically test the connection

## 💰 Cost Breakdown

- **Railway**: Free tier (500 hours/month) → $5/month for hobby plan
- **Render**: Free tier (750 hours/month) → $7/month for starter plan
- **MongoDB Atlas**: Free (M0 cluster, 512MB)
- **Cloudflare Pages**: Free
- **Total**: $0-7/month depending on usage

## 🔧 Troubleshooting

**Backend won't start:**
- Check MongoDB connection string format
- Verify environment variables are set
- Check deployment logs in your hosting platform

**Frontend can't connect:**
- Verify VITE_API_URL is set correctly
- Check CORS settings (ALLOWED_ORIGINS)
- Ensure backend is deployed and healthy

**MongoDB connection issues:**
- Check network access settings (allow 0.0.0.0/0)
- Verify database user has correct permissions
- Test connection string in MongoDB Compass

## 🏗️ What's Different from Cloudflare Functions

| Feature | Cloudflare Functions | Node.js Backend |
|---------|---------------------|-----------------|
| **Scalability** | Serverless, instant scale | Traditional server scaling |
| **Cold starts** | ~10ms | ~100ms first request |
| **Deployment** | Part of Pages deployment | Separate deployment |
| **Cost** | Free up to 100k requests | $5-7/month |
| **Maintenance** | Zero maintenance | Regular dependency updates |
| **Database** | Required realm-web (deprecated) | Native MongoDB driver |
| **Future-proof** | ❌ Depends on deprecated SDK | ✅ Uses stable, long-term APIs |

## 🔄 Migration Benefits

✅ **Future-proof**: No deprecated dependencies  
✅ **More features**: Full Express.js ecosystem  
✅ **Better debugging**: Detailed server logs  
✅ **Flexible deployment**: Multiple hosting options  
✅ **Standard architecture**: Easier to maintain and extend

Your app will work exactly the same way for users, but now it's built on stable, long-term technology!