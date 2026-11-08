// Shared helpers for talking to SunoAPI.org from Netlify Functions.
// The API key lives ONLY in the SUNO_API_KEY environment variable (set in Netlify UI).

export const SUNO_BASE = 'https://api.sunoapi.org/api/v1';

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function checkAccess(req) {
  const required = process.env.ACCESS_CODE;
  if (!required) return null;
  if (req.headers.get('x-access-code') !== required) {
    return json({ code: 401, msg: 'Invalid or missing access code.' }, 401);
  }
  return null;
}

export async function suno(path, { method = 'GET', body } = {}) {
  const key = process.env.SUNO_API_KEY;
  if (!key) {
    return { code: 500, msg: 'Server is missing SUNO_API_KEY. Add it in Netlify → Site configuration → Environment variables.' };
  }
  try {
    const res = await fetch(`${SUNO_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { code: res.status, msg: text.slice(0, 300) || `Upstream HTTP ${res.status}` };
    }
  } catch (err) {
    return { code: 502, msg: `Could not reach SunoAPI: ${err.message}` };
  }
}

// SunoAPI requires a callBackUrl. We point it at our own (no-op) callback function;
// the frontend polls for status instead.
export function callbackUrl(req) {
  const base = process.env.URL || new URL(req.url).origin;
  return `${base}/.netlify/functions/callback`;
}

export const MODELS = ['V6', 'V6_WILD', 'V6_MINI'];

export function clampNum(v, min, max, decimals = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const f = 10 ** decimals;
  return Math.round(Math.min(max, Math.max(min, n)) * f) / f;
}
