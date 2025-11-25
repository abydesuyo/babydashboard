import { connectToDatabase, json, corsHeaders } from './_shared/database.js';

// Cloudflare Pages Function - GET /health
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet({ env }) {
  try {
    // Check database connection
    await connectToDatabase(env);

    return json({
      status: 'healthy',
      database: 'connected',
      runtime: 'cloudflare-pages',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return json({
      status: 'unhealthy',
      error: error.message
    }, 500);
  }
}