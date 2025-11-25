// Validate Google access token via UserInfo and derive email server-side
const CACHE_TTL_MS = 5 * 60 * 1000;
const tokenCache = new Map(); // token -> { email, expAt }

export async function requireAuth(request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return { error: json({ error: 'Authorization token required' }, 401) };
  }
  const token = auth.slice(7).trim();
  if (!token) return { error: json({ error: 'Invalid token' }, 401) };

  const cached = tokenCache.get(token);
  const now = Date.now();
  if (cached && cached.expAt > now) {
    return { token, email: cached.email };
  }

  const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return { error: json({ error: 'Invalid Google token', detail: text.slice(0, 200) }, 401) };
  }
  const data = await resp.json().catch(() => ({}));
  const email = data?.email;
  const emailVerified = data?.email_verified;
  if (!email || emailVerified === false) {
    return { error: json({ error: 'Email not available or not verified' }, 401) };
  }
  tokenCache.set(token, { email, expAt: now + CACHE_TTL_MS });
  return { token, email };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
