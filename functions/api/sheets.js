// Cloudflare Pages Function - GET /api/sheets and POST /api/sheets
import * as Realm from "realm-web";

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
  const app = new Realm.App({ id: context.env.MONGODB_APP_ID });
  const credentials = Realm.Credentials.apiKey(context.env.MONGODB_API_KEY);
  const user = await app.logIn(credentials);
  const mongo = user.mongoClient("mongodb-atlas");
  const db = mongo.db("baby-dashboard");
  
  return {
    users: db.collection("users"),
    userSheets: db.collection("user_sheets")
  };
}

// Ensure user exists in database
async function ensureUser(collections, userInfo) {
  const { users } = collections;
  
  await users.updateOne(
    { email: userInfo.email },
    {
      $set: {
        email: userInfo.email,
        name: userInfo.name,
        pictureUrl: userInfo.picture || null,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );
}

// Handle GET /api/sheets - Get user's saved sheets
async function handleGetSheets(collections, userEmail) {
  try {
    const { userSheets } = collections;
    
    const sheets = await userSheets.find(
      { userEmail },
      { 
        sort: { lastAccessed: -1 },
        projection: {
          _id: 0,
          sheetId: 1,
          sheetName: 1,
          spreadsheetId: 1,
          role: 1,
          createdBy: 1,
          lastAccessed: 1
        }
      }
    );

    // Transform to match frontend expectations
    const transformedSheets = sheets.map(sheet => ({
      id: sheet.sheetId,
      name: sheet.sheetName,
      spreadsheetId: sheet.spreadsheetId,
      role: sheet.role,
      lastAccessed: sheet.lastAccessed.toISOString(),
      createdBy: sheet.createdBy || undefined
    }));

    return new Response(JSON.stringify({ sheets: transformedSheets }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error getting sheets:', error);
    return new Response(JSON.stringify({ error: 'Failed to get sheets' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Handle POST /api/sheets - Save a new sheet
async function handleSaveSheet(collections, userEmail, sheetData) {
  try {
    const { userSheets } = collections;
    
    const sheetDoc = {
      userEmail,
      sheetId: sheetData.id,
      sheetName: sheetData.name,
      spreadsheetId: sheetData.spreadsheetId,
      role: sheetData.role,
      createdBy: sheetData.createdBy || null,
      lastAccessed: new Date(sheetData.lastAccessed),
      createdAt: new Date()
    };

    await userSheets.updateOne(
      { userEmail, sheetId: sheetData.id },
      { $set: sheetDoc },
      { upsert: true }
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error saving sheet:', error);
    return new Response(JSON.stringify({ error: 'Failed to save sheet' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Main function handler
export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

  try {
    // Initialize MongoDB connection
    const collections = await initMongoDB(context);
    
    // Ensure user exists in database
    await ensureUser(collections, userInfo);

    // Route requests
    if (request.method === 'GET') {
      return await handleGetSheets(collections, userInfo.email);
    } 
    else if (request.method === 'POST') {
      const sheetData = await request.json();
      return await handleSaveSheet(collections, userInfo.email, sheetData);
    }
    else {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
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
  }
}