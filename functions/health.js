import { getDb, json, corsHeaders } from './_shared/database.js';
import { sql } from 'drizzle-orm';

// Cloudflare Pages Function - GET /health
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet({ env }) {
  try {
    // Check database connection
    const db = getDb(env);
    await db.run(sql`SELECT 1`);

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