// Shared MongoDB connection helper for Cloudflare Pages Functions
import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    // Test the connection to make sure it's still alive
    try {
      await cachedDb.admin().ping();
      return { client: cachedClient, db: cachedDb };
    } catch (error) {
      console.warn('Cached connection failed, reconnecting:', error.message);
      cachedClient = null;
      cachedDb = null;
    }
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  const client = new MongoClient(process.env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  try {
    await client.connect();
    const db = client.db('baby-dashboard');

    // Test the connection
    await db.admin().ping();

    cachedClient = client;
    cachedDb = db;

    return { client, db };
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

// Helper to call MongoDB Atlas Data API
// Expects env bindings:
// - DATA_API_URL (ends with /action)
// - DATA_API_KEY
// - DATA_SOURCE (e.g., Cluster0)
// - DB_NAME (e.g., baby-dashboard)

export async function mongoAction(env, action, payload = {}) {
  const url = `${env.DATA_API_URL}/${action}`;
  const body = JSON.stringify({
    dataSource: env.DATA_SOURCE,
    database: env.DB_NAME,
    ...payload,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.DATA_API_KEY,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Data API ${action} failed: ${res.status} ${text.slice(0, 500)}`);
  }

  return res.json();
}

// Helper to handle database operations with proper error handling
export async function withDatabase(operation) {
  try {
    const { db } = await connectToDatabase();
    return await operation(db);
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  }
}

// Gracefully close the connection (useful for cleanup)
export async function closeConnection() {
  if (cachedClient) {
    try {
      await cachedClient.close();
      cachedClient = null;
      cachedDb = null;
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
    }
  }
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email',
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}