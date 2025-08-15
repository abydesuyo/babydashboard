// Cloudflare Pages Function - /api/sheets
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
      // For now, return empty array - we'll integrate MongoDB later
      return new Response(JSON.stringify({ savedSheets: [] }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    if (request.method === 'POST') {
      // For now, just return success - we'll integrate MongoDB later
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}