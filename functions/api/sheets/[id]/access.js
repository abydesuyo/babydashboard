// Cloudflare Pages Function - PUT /api/sheets/[id]/access
import { MongoClient } from "mongodb";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Will be updated to specific domain in production
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Verify Google OAuth token and get user info
async function verifyGoogleToken(token) {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Initialize MongoDB connection
async function initMongoDB(context) {
  const client = new MongoClient(context.env.MONGODB_URI);
  await client.connect();
  const db = client.db("baby-dashboard");
  
  return {
    client,
    userSheets: db.collection("user_sheets")
  };
}

// Main function handler
export async function onRequest(context) {
  const { request, params } = context;
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow PUT requests
  if (request.method !== 'PUT') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Extract sheet ID from URL params
  const sheetId = params.id;
  if (!sheetId) {
    return new Response(JSON.stringify({ error: 'Sheet ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Extract and verify auth token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const token = authHeader.substring(7);
  const userInfo = await verifyGoogleToken(token);
  
  if (!userInfo) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  let collections = null;
  try {
    // Initialize MongoDB connection
    collections = await initMongoDB(context);
    const { userSheets } = collections;
    
    // Update last accessed time
    await userSheets.updateOne(
      { userEmail: userInfo.email, sheetId },
      { $set: { lastAccessed: new Date() } }
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error updating sheet access:', error);
    return new Response(JSON.stringify({ error: 'Failed to update access' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } finally {
    // Close MongoDB connection
    if (collections?.client) {
      await collections.client.close();
    }
  }
}