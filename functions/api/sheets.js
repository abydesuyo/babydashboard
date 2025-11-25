// Cloudflare Pages Function - /api/sheets
import { mongoAction, json } from '../_shared/database.js';
import { requireAuth } from '../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { email } = auth;
  try {
    const result = await mongoAction(env, 'find', {
      collection: 'user_sheets',
      filter: { userEmail: email },
      sort: { lastAccessed: -1 },
    });
    const docs = result.documents || [];
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
    return json({ error: 'Failed to fetch sheets' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { email } = auth;

  let body = {};
  try { body = await request.json(); } catch {}
  const { sheetId, sheetName, spreadsheetId, role = 'owner' } = body;
  if (!sheetId || !sheetName || !spreadsheetId) {
    return json({ error: 'Missing required fields' }, 400);
  }

  try {
    await mongoAction(env, 'updateOne', {
      collection: 'user_sheets',
      filter: { userEmail: email, sheetId },
      update: {
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
      upsert: true,
    });

    await mongoAction(env, 'updateOne', {
      collection: 'users',
      filter: { email },
      update: {
        $set: { email, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      upsert: true,
    });

    return json({ success: true, message: 'Sheet saved successfully' });
  } catch (e) {
    return json({ error: 'Failed to save sheet' }, 500);
  }
}