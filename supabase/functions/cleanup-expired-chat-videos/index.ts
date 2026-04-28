import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const nowIso = new Date().toISOString();

    const { data: expiredMessages, error: fetchError } = await supabase
      .from('messages')
      .select('id, media_path, message_kind, expires_at')
      .eq('message_kind', 'video')
      .not('media_path', 'is', null)
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso);

    if (fetchError) {
      return new Response(
        JSON.stringify({
          ok: false,
          step: 'fetch_expired_messages',
          error: fetchError.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const rows = (expiredMessages || []).filter(
      (row) =>
        typeof row.media_path === 'string' &&
        row.media_path.length > 0 &&
        !row.media_path.startsWith('journal/')
    );

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          deletedFiles: 0,
          updatedMessages: 0,
          message: 'No expired chat videos found.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const filePaths = rows
      .map((row) => row.media_path)
      .filter((value): value is string => !!value);

    const messageIds = rows.map((row) => row.id);

    const { error: removeError } = await supabase.storage
      .from("chat-media")
      .remove(filePaths);

    if (removeError) {
      return new Response(
        JSON.stringify({
          ok: false,
          step: 'delete_storage_files',
          error: removeError.message,
          filePaths,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update({
        media_path: null,
        content: 'This video has expired',
      })
      .in('id', messageIds);

    if (updateError) {
      return new Response(
        JSON.stringify({
          ok: false,
          step: 'update_messages',
          error: updateError.message,
          messageIds,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        deletedFiles: filePaths.length,
        updatedMessages: messageIds.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        ok: false,
        step: 'unexpected',
        error: message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});