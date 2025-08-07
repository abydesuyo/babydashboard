// Cloudflare Pages Function - GET /api/health
import * as Realm from "realm-web";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Will be updated to specific domain in production
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Main function handler
export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Test MongoDB connection
    let mongoStatus = 'disconnected';
    let mongoError = null;
    
    try {
      if (env.MONGODB_APP_ID && env.MONGODB_API_KEY) {
        const app = new Realm.App({ id: env.MONGODB_APP_ID });
        const credentials = Realm.Credentials.apiKey(env.MONGODB_API_KEY);
        const user = await app.logIn(credentials);
        mongoStatus = user ? 'connected' : 'authentication_failed';
      } else {
        mongoStatus = 'not_configured';
      }
    } catch (error) {
      mongoStatus = 'error';
      mongoError = error.message;
    }

    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: 'cloudflare-pages',
      database: {
        mongodb: {
          status: mongoStatus,
          error: mongoError
        }
      },
      version: '1.0.0'
    };

    return new Response(JSON.stringify(healthCheck, null, 2), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}