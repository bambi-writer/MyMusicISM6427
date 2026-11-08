// SunoAPI requires a callBackUrl; we acknowledge callbacks and rely on polling for results.
export default async (req) => {
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('Suno callback', body?.data?.callbackType, body?.data?.task_id, body?.code);
    } catch {
      /* ignore */
    }
  }
  return new Response(JSON.stringify({ status: 'received' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
