import { json, suno, checkAccess } from '../lib/suno.mjs';

// GET /api/lyrics-status?taskId=...  -> SunoAPI GET /lyrics/record-info
export default async (req) => {
  const denied = checkAccess(req);
  if (denied) return denied;
  const taskId = new URL(req.url).searchParams.get('taskId');
  if (!taskId) return json({ code: 400, msg: 'taskId is required' }, 400);

  const result = await suno(`/lyrics/record-info?taskId=${encodeURIComponent(taskId)}`);
  if (result.code !== 200) return json(result, 400);
  const d = result.data || {};
  const options = (d.response?.data || [])
    .filter((x) => x.status !== 'failed' && x.text)
    .map((x) => ({ title: x.title || '', text: x.text.replace(/^\|-\s*\n/, '') }));
  return json({ code: 200, data: { status: d.status || 'PENDING', errorMessage: d.errorMessage || null, options } });
};
