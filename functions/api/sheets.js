// Cloudflare Pages Function - /api/sheets
import { connectToDatabase, json, corsHeaders } from '../_shared/database.js';
import { requireAuth } from '../_shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { email } = auth;

  try {
    const { db } = await connectToDatabase(env);
    const docs = await db.collection('user_sheets')
      .find({ userEmail: email })
      .sort({ lastAccessed: -1 })
      .toArray();

    const savedSheets = docs.map(doc => ({
      id: doc.sheetId,
      name: doc.sheetName,
      spreadsheetId: doc.spreadsheetId,
      role: doc.role,
      lastAccessed: doc.lastAccessed,
      createdBy: doc.createdBy,
    }));
    return json({ savedSheets });
  } catch (e) {
    console.error('Error fetching sheets:', e);
    return json({ error: 'Failed to fetch sheets', details: e.message, stack: e.stack }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { email } = auth;

  let body = {};
  try { body = await request.json(); } catch { }
  const { sheetId, sheetName, spreadsheetId, role = 'owner' } = body;
  if (!sheetId || !sheetName || !spreadsheetId) {
    return json({ error: 'Missing required fields' }, 400);
  }

  try {
    const { db } = await connectToDatabase(env);

    await db.collection('user_sheets').updateOne(
      { userEmail: email, sheetId },
      {
        $set: {
          userEmail: email,
          sheetId,
          sheetName,
          spreadsheetId,
          role,
          createdBy: email,
          lastAccessed: new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    await db.collection('users').updateOne(
      { email },
      {
        $set: { email, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    return json({ success: true, message: 'Sheet saved successfully' });
  } catch (e) {
    console.error('Error saving sheet:', e);
    return json({ error: 'Failed to save sheet' }, 500);
  }
}