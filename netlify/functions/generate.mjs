import { json, suno, checkAccess, callbackUrl, MODELS, clampNum } from '../lib/suno.mjs';

// POST /api/generate  -> SunoAPI POST /generate
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

  const customMode = !!input.customMode;
  const instrumental = !!input.instrumental;
  const model = MODELS.includes(input.model) ? input.model : 'V6';
  const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

  const body = { customMode, instrumental, model, callBackUrl: callbackUrl(req) };

  if (customMode) {
    body.title = str(input.title, 80);
    body.style = str(input.style, 1000);
    if (!instrumental) body.lyrics = str(input.lyrics, 5000);
    body.negativeTags = str(input.negativeTags, 1000);
    if (input.vocalGender === 'm' || input.vocalGender === 'f') body.vocalGender = input.vocalGender;
    if (input.styleWeight !== undefined && input.styleWeight !== '') body.styleWeight = clampNum(input.styleWeight, 0, 1);
    if (input.weirdnessConstraint !== undefined && input.weirdnessConstraint !== '')
      body.weirdnessConstraint = clampNum(input.weirdnessConstraint, 0, 1);
    if (input.variety !== undefined && input.variety !== '') body.variety = clampNum(input.variety, 0, 4, 0);
    if (input.duration) body.duration = clampNum(input.duration, 10, 360, 0);
    if (!body.style && !body.lyrics && !body.negativeTags) {
      return json({ code: 400, msg: 'Custom mode needs at least a style, lyrics, or negative tags.' }, 400);
    }
  } else {
    body.prompt = str(input.prompt, 3000);
    body.style = str(input.style, 1000);
    if (!body.prompt && !body.style) {
      return json({ code: 400, msg: 'Please describe the song you want.' }, 400);
    }
  }

  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

  const result = await suno('/generate', { method: 'POST', body });
  return json(result, result.code === 200 ? 200 : 400);
};
