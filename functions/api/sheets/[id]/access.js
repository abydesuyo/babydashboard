// Cloudflare Pages Function - /api/sheets/[id]/access
import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('baby-dashboard');
    
    cachedClient = client;
    cachedDb = db;
    
    return { client, db };
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw new Error('Database connection failed');
  }
}

export async function onRequest(context) {
  const { request, params } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Extract auth info
  const authHeader = request.headers.get('Authorization');
  const userEmail = request.headers.get('X-User-Email');
  
  if (!authHeader || !authHeader.startsWith('Bearer ') || !userEmail) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const sheetId = params.id;
  
  try {
    if (request.method === 'PUT') {
      try {
        const { db } = await connectToDatabase();
        
        const result = await db.collection('user_sheets').updateOne(
          { userEmail, sheetId },
          { $set: { lastAccessed: new Date() } }
        );

        if (result.matchedCount === 0) {
          return new Response(JSON.stringify({ error: 'Sheet not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (dbError) {
        console.error('Database update error:', dbError);
        return new Response(JSON.stringify({ error: 'Failed to update sheet access' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Request error:', error);
    return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}