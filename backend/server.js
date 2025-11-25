import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

let db;
let client;

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later.' }
});

app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginEmbedderPolicy: false
}));
app.use(limiter);
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

async function connectToMongoDB() {
  try {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('baby-dashboard');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

function verifyGoogleToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }
  const token = authHeader.substring(7);
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }
  req.token = token;
  req.userEmail = req.headers['x-user-email'];
  if (!req.userEmail) {
    return res.status(400).json({ error: 'User email required in headers' });
  }
  next();
}

app.get('/health', async (req, res) => {
  try {
    await db.admin().ping();
    res.json({ status: 'healthy', mongodb: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', mongodb: 'disconnected', error: error.message });
  }
});

// REST-friendly alias so clients can hit /api/health (no redirect)
app.get('/api/health', async (req, res) => {
  try {
    await db.admin().ping();
    res.json({ status: 'healthy', mongodb: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', mongodb: 'disconnected', error: error.message });
  }
});

// Optional API index endpoint for quick sanity checks
app.get('/api', (req, res) => {
  res.json({
    name: 'baby-dashboard-api',
    version: '1.0',
    endpoints: [
      'GET  /api/health',
      'GET  /api/sheets',
      'POST /api/sheets',
      'PUT  /api/sheets/:id/access'
    ]
  });
});

app.get('/api/sheets', verifyGoogleToken, async (req, res) => {
  try {
    const userSheets = await db.collection('user_sheets')
      .find({ userEmail: req.userEmail })
      .sort({ lastAccessed: -1 })
      .toArray();

    const savedSheets = userSheets.map(sheet => ({
      id: sheet.sheetId,
      name: sheet.sheetName,
      spreadsheetId: sheet.spreadsheetId,
      role: sheet.role,
      lastAccessed: sheet.lastAccessed,
      createdBy: sheet.createdBy
    }));

    res.json({ savedSheets });
  } catch (error) {
    console.error('Error fetching sheets:', error);
    res.status(500).json({ error: 'Failed to fetch sheets' });
  }
});

app.post('/api/sheets', verifyGoogleToken, async (req, res) => {
  try {
    const { sheetId, sheetName, spreadsheetId, role = 'owner' } = req.body;
    if (!sheetId || !sheetName || !spreadsheetId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const existingSheet = await db.collection('user_sheets').findOne({ userEmail: req.userEmail, sheetId });
    if (existingSheet) {
      await db.collection('user_sheets').updateOne(
        { _id: existingSheet._id },
        { $set: { lastAccessed: new Date(), sheetName, spreadsheetId } }
      );
    } else {
      await db.collection('user_sheets').insertOne({
        userEmail: req.userEmail,
        sheetId,
        sheetName,
        spreadsheetId,
        role,
        createdBy: req.userEmail,
        lastAccessed: new Date(),
        createdAt: new Date()
      });
    }
    await db.collection('users').updateOne(
      { email: req.userEmail },
      { $set: { email: req.userEmail, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    res.json({ success: true, message: 'Sheet saved successfully' });
  } catch (error) {
    console.error('Error saving sheet:', error);
    res.status(500).json({ error: 'Failed to save sheet' });
  }
});

app.put('/api/sheets/:id/access', verifyGoogleToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.collection('user_sheets').updateOne(
      { userEmail: req.userEmail, sheetId: id },
      { $set: { lastAccessed: new Date() } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Sheet not found' });
    }
    res.json({ success: true, message: 'Last accessed time updated' });
  } catch (error) {
    console.error('Error updating sheet access:', error);
    res.status(500).json({ error: 'Failed to update sheet access' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down gracefully...');
  if (client) {
    await client.close();
    console.log('📦 MongoDB connection closed');
  }
  process.exit(0);
});

async function startServer() {
  await connectToMongoDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API base: http://localhost:${PORT}/api`);
  });
}

startServer().catch(console.error);