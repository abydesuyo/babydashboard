// Cloudflare Pages Function - PUT /api/sheets/[id]/access and DELETE /api/sheets/[id]
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
    users: db.collection("users"),
    userSheets: db.collection("user_sheets")
  };
}

// Handle PUT /api/sheets/[id]/access - Update last accessed time
async function handleUpdateAccess(collections, userEmail, sheetId) {
  try {
    const { userSheets } = collections;
    
    await userSheets.updateOne(
      { userEmail, sheetId },
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
  }
}

// Handle DELETE /api/sheets/[id] - Remove sheet from user's collection
async function handleDeleteSheet(collections, userEmail, sheetId) {
  try {
    const { userSheets } = collections;
    
    await userSheets.deleteOne({ userEmail, sheetId });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error deleting sheet:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete sheet' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Main function handler
export async function onRequest(context) {
  const { request, params, env } = context;
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Parse URL to check for special endpoints
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const isAccessEndpoint = pathSegments[pathSegments.length - 1] === 'access';

    // Route requests
    if (request.method === 'PUT' && isAccessEndpoint) {
      return await handleUpdateAccess(collections, userInfo.email, sheetId);
    } 
    else if (request.method === 'DELETE' && !isAccessEndpoint) {
      return await handleDeleteSheet(collections, userInfo.email, sheetId);
    }
    else {
      return new Response(JSON.stringify({ error: 'Method not allowed or invalid endpoint' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return new Response(JSON.stringify({ error: 'Database connection failed' }), {
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