// Cloudflare Pages Function - /api/sheets/[id]/access
import { getDb, json, corsHeaders } from '../../../_shared/database.js';
import { requireAuth } from '../../../_shared/auth.js';
import { userSheets } from '../../../_shared/schema.js';
import { eq, and } from 'drizzle-orm';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPut({ request, params, env }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { email } = auth;
  const { id } = params;

  try {
    const db = getDb(env);
    const result = await db.update(userSheets)
      .set({ lastAccessed: new Date() })
      .where(and(
        eq(userSheets.sheetId, id),
        eq(userSheets.userEmail, email)
      ))
      .returning();

    if (result.length === 0) {
      return json({ error: 'Sheet not found' }, 404);
    }
    return json({ success: true, message: 'Last accessed time updated' });
  } catch (e) {
    console.error('Error updating sheet access:', e);
    return json({ error: 'Failed to update sheet access', details: e.message }, 500);
  }
}