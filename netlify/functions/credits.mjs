import { json, suno, checkAccess } from '../lib/suno.mjs';

// GET /api/credits  -> SunoAPI GET /generate/credit
export default async (req) => {
  const denied = checkAccess(req);
  if (denied) return denied;
  const result = await suno('/generate/credit');
  return json(result, result.code === 200 ? 200 : 400);
};
