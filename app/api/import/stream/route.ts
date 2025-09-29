import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/external/supabase/server';
import { progressManager } from '@/lib/data/import/progress-tracker';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const importId = searchParams.get('id');

  if (!importId) {
    return NextResponse.json({ error: 'Import ID required' }, { status: 400 });
  }

  const { data: importRecord, error } = await supabase
    .from('import_history')
    .select('id, user_id')
    .eq('id', importId)
    .eq('user_id', user.id)
    .single();

  if (error || !importRecord) {
    return NextResponse.json({ error: 'Import not found' }, { status: 404 });
  }


  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const tracker = progressManager.getTracker(importId);

      if (!tracker) {
        const { data: existingImport } = await supabase
          .from('import_history')
          .select('*')
          .eq('id', importId)
          .single();

        if (existingImport) {
          const event = `data: ${JSON.stringify({
            importId,
            total: existingImport.total_nodes,
            processed: existingImport.total_nodes,
            successful: existingImport.successful_nodes || 0,
            failed: existingImport.failed_nodes || 0,
            percentage: 100,
            status: existingImport.status,
            message: 'Import already completed',
            timestamp: existingImport.completed_at || existingImport.started_at,
          })}\n\n`;
          
          controller.enqueue(encoder.encode(event));
        } else {
          const errorEvent = `data: ${JSON.stringify({
            error: 'Import not found or not started yet',
            importId,
          })}\n\n`;
          
          controller.enqueue(encoder.encode(errorEvent));
        }
        
        controller.close();
        return;
      }

      const sendProgress = (progress: any) => {
        try {
          const event = `data: ${JSON.stringify(progress)}\n\n`;
          controller.enqueue(encoder.encode(event));

          if (progress.status === 'completed' || progress.status === 'failed') {
            setTimeout(() => {
              controller.close();
              progressManager.removeTracker(importId);
            }, 1000);
          }
        } catch (error) {
          console.error('Error sending SSE:', error);
        }
      };

      const currentProgress = tracker.getProgress();
      sendProgress(currentProgress);

      tracker.on('progress', sendProgress);

      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      const timeout = setTimeout(() => {
        clearInterval(heartbeatInterval);
        tracker.removeListener('progress', sendProgress);
        controller.close();
        progressManager.removeTracker(importId);
      }, 10 * 60 * 1000);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        clearTimeout(timeout);
        tracker.removeListener('progress', sendProgress);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}