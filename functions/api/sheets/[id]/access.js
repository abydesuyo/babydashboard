// Cloudflare Pages Function - /api/sheets/[id]/access
import { mongoAction, json } from '../../../_shared/database.js';
import { requireAuth } from '../../../_shared/auth.js';

export async function onRequestPut({ request, params, env }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { email } = auth;
  const { id } = params;

  try {
    const result = await mongoAction(env, 'updateOne', {
      collection: 'user_sheets',
      filter: { userEmail: email, sheetId: id },
      update: { $set: { lastAccessed: new Date() } },
    });
    if ((result.matchedCount || 0) === 0) {
      return json({ error: 'Sheet not found' }, 404);
    }
    return json({ success: true, message: 'Last accessed time updated' });
  } catch (e) {
    return json({ error: 'Failed to update sheet access' }, 500);
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
        const result = await mongoAction(env, 'updateOne', {
          collection: 'user_sheets',
          filter: { userEmail, sheetId },
          update: { $set: { lastAccessed: new Date() } },
        });

        if ((result.matchedCount || 0) === 0) {
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