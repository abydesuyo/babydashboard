import { json, corsHeaders } from './_shared/database.js';

// Cloudflare Pages Function - GET /health
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet() {
  try {
    // Simple health check
    return json({
      status: 'healthy',
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