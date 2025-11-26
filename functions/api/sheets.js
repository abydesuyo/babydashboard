// Cloudflare Pages Function - /api/sheets
import { getDb, json, corsHeaders } from '../_shared/database.js';
import { requireAuth } from '../_shared/auth.js';
import { users, userSheets } from '../_shared/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { email } = auth;

  try {
    const db = getDb(env);

    // Fetch sheets for the user
    const results = await db.select()
      .from(userSheets)
      .where(eq(userSheets.userEmail, email))
      .orderBy(desc(userSheets.lastAccessed));

    const savedSheets = results.map(doc => ({
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
    return json({ error: 'Failed to fetch sheets', details: e.message }, 500);
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
    const db = getDb(env);
    const now = new Date();

    // Upsert User
    await db.insert(users)
      .values({ email, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: users.email,
        set: { updatedAt: now }
      });

    // Upsert User Sheet
    await db.insert(userSheets)
      .values({
        sheetId,
        userEmail: email,
        sheetName,
        spreadsheetId,
        role,
        createdBy: email,
        lastAccessed: now,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: userSheets.sheetId,
        set: {
          sheetName,
          spreadsheetId,
          role,
          lastAccessed: now,
          updatedAt: now
        }
      });

    return json({ success: true, message: 'Sheet saved successfully' });
  } catch (e) {
    console.error('Error saving sheet:', e);
    return json({ error: 'Failed to save sheet', details: e.message }, 500);
  }
}