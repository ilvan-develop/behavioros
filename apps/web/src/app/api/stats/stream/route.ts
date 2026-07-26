import { getBehaviorOS } from '@/lib/bos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const INTERVAL_MS = 5000;

async function fetchStatsPayload() {
  try {
    const bos = getBehaviorOS();
    const status = bos.getStatus();
    const stats = bos.getStats();
    const pipelineState = bos.getPipelineState();
    return { status, stats, pipeline: pipelineState ?? null };
  } catch {
    return { error: 'Failed to fetch stats' };
  }
}

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        const payload = await fetchStatsPayload();
        const data = `data: ${JSON.stringify(payload)}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          clearInterval(timer);
        }
      };
      await send();
      const timer = setInterval(send, INTERVAL_MS);
      req.signal.addEventListener('abort', () => {
        clearInterval(timer);
        controller.close();
      });
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
