import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function normalizeGuideGender(value: unknown): 'male' | 'female' | 'both' {
  if (value === 'male' || value === 'female' || value === 'both') return value;
  return 'both';
}

function normalizeUsername(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const email = String(body.email || '').trim().toLowerCase();
    const username = normalizeUsername(body.username);
    const guide_gender = normalizeGuideGender(body.guide_gender);

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    if (!username) {
      return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
    }

    if (!username.startsWith('LoveF8Guide')) {
      return NextResponse.json(
        { error: 'Guide usernames must start with LoveF8Guide.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return NextResponse.json(
        { error: 'Missing Supabase environment variables.' },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing auth token.' }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();

    // User-scoped client: verify caller is signed in
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // Check admin role from public.profiles
    const { data: adminProfile, error: adminProfileError } = await userClient
      .from('profiles')
      .select('app_role')
      .eq('id', user.id)
      .single();

    if (adminProfileError || !adminProfile || adminProfile.app_role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    // Service-role client: invite guide
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: 'That username is already in use.' },
        { status: 409 }
      );
    }

    const redirectTo =
      process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth`
        : undefined;

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        username,
        is_guide: true,
        guide_gender,
      },
      ...(redirectTo ? { redirectTo } : {}),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      invited_user_id: data.user?.id ?? null,
      email,
      username,
      guide_gender,
    });
  } catch (error) {
    console.error('invite-guide route error:', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}