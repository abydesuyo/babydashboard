// Cloudflare Pages Function - /api/sheets/[id]/access
import { connectToDatabase, json, corsHeaders } from '../../../_shared/database.js';
import { requireAuth } from '../../../_shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPut({ request, params, env }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { email } = auth;
  const { id } = params;

  try {
    const { db } = await connectToDatabase(env);
    const result = await db.collection('user_sheets').updateOne(
      { userEmail: email, sheetId: id },
      { $set: { lastAccessed: new Date() } }
    );

    if (result.matchedCount === 0) {
      return json({ error: 'Sheet not found' }, 404);
    }
    return json({ success: true, message: 'Last accessed time updated' });
  } catch (e) {
    console.error('Error updating sheet access:', e);
    return json({ error: 'Failed to update sheet access' }, 500);
  }
}