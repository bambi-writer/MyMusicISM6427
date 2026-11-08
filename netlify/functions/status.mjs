import { json, suno, checkAccess } from '../lib/suno.mjs';

// GET /api/status?taskId=...  -> SunoAPI GET /generate/record-info
export default async (req) => {
  const denied = checkAccess(req);
  if (denied) return denied;
  const taskId = new URL(req.url).searchParams.get('taskId');
  if (!taskId) return json({ code: 400, msg: 'taskId is required' }, 400);

  const result = await suno(`/generate/record-info?taskId=${encodeURIComponent(taskId)}`);
  if (result.code !== 200) return json(result, 400);

  const d = result.data || {};
  const raw = d.response?.sunoData || d.response?.data || [];
  const tracks = raw.map((t) => ({
    id: t.id,
    title: t.title,
    tags: t.tags,
    prompt: t.prompt,
    duration: t.duration,
    audioUrl: t.audio_url || t.audioUrl || '',
    streamUrl: t.stream_audio_url || t.streamAudioUrl || '',
    imageUrl: t.image_url || t.imageUrl || '',
    createTime: t.createTime,
  }));

  return json({
    code: 200,
    data: {
      taskId: d.taskId || taskId,
      status: d.status || 'PENDING',
      errorMessage: d.errorMessage || null,
      tracks,
    },
  });
};
