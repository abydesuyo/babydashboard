// Shared D1 connection helper for Cloudflare Pages Functions
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.js';

export function getDb(env) {
  if (!env.DB) {
    throw new Error('D1 database binding (DB) not found in env');
  }
  return drizzle(env.DB, { schema });
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email',
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}