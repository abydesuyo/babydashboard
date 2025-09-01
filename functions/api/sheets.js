// Cloudflare Pages Function - /api/sheets
import { withDatabase } from '../_shared/database.js';

export async function onRequest(context) {
  const { request, env } = context;
  
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

  try {
    if (request.method === 'GET') {
      try {
        const savedSheets = await withDatabase(async (db) => {
          const userSheets = await db.collection('user_sheets')
            .find({ userEmail })
            .sort({ lastAccessed: -1 })
            .toArray();

          return userSheets.map(sheet => ({
            id: sheet.sheetId,
            name: sheet.sheetName,
            spreadsheetId: sheet.spreadsheetId,
            role: sheet.role,
            lastAccessed: sheet.lastAccessed,
            createdBy: sheet.createdBy
          }));
        });

        return new Response(JSON.stringify({ savedSheets }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (dbError) {
        console.error('Database query error:', dbError);
        // Fallback to empty array if DB unavailable
        return new Response(JSON.stringify({ savedSheets: [] }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }
    
    if (request.method === 'POST') {
      try {
        const { sheetId, sheetName, spreadsheetId, role = 'owner' } = await request.json();
        
        if (!sheetId || !sheetName || !spreadsheetId) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        await withDatabase(async (db) => {
          const existingSheet = await db.collection('user_sheets').findOne({
            userEmail,
            sheetId
          });

          if (existingSheet) {
            await db.collection('user_sheets').updateOne(
              { _id: existingSheet._id },
              { 
                $set: { 
                  lastAccessed: new Date(),
                  sheetName,
                  spreadsheetId
                }
              }
            );
          } else {
            await db.collection('user_sheets').insertOne({
              userEmail,
              sheetId,
              sheetName,
              spreadsheetId,
              role,
              createdBy: userEmail,
              lastAccessed: new Date(),
              createdAt: new Date()
            });
          }

          // Update user record
          await db.collection('users').updateOne(
            { email: userEmail },
            { 
              $set: { 
                email: userEmail,
                updatedAt: new Date()
              },
              $setOnInsert: { 
                createdAt: new Date()
              }
            },
            { upsert: true }
          );
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (dbError) {
        console.error('Database save error:', dbError);
        return new Response(JSON.stringify({ error: 'Failed to save sheet' }), {
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
    // If MongoDB is unavailable, fallback gracefully
    if (request.method === 'GET') {
      return new Response(JSON.stringify({ savedSheets: [] }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}