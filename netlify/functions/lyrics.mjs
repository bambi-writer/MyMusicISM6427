import { json, suno, checkAccess, callbackUrl } from '../lib/suno.mjs';

// POST /api/lyrics  -> SunoAPI POST /lyrics
export default async (req) => {
  if (req.method !== 'POST') return json({ code: 405, msg: 'Use POST' }, 405);
  const denied = checkAccess(req);
  if (denied) return denied;
  let input;
  try {
    input = await req.json();
  } catch {
    return json({ code: 400, msg: 'Invalid JSON body' }, 400);
  }
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim().slice(0, 200) : '';
  if (!prompt) return json({ code: 400, msg: 'Describe what the lyrics should be about.' }, 400);

  const result = await suno('/lyrics', { method: 'POST', body: { prompt, callBackUrl: callbackUrl(req) } });
  return json(result, result.code === 200 ? 200 : 400);
};
