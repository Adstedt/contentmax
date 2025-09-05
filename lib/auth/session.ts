import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export async function getSession(request?: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  
  return session;
}

export async function getUser(request?: NextRequest) {
  const session = await getSession(request);
  return session?.user || null;
}

export async function requireAuth(request?: NextRequest) {
  const session = await getSession(request);
  
  if (!session) {
    throw new Error('Authentication required');
  }
  
  return session;
}

// Alias for getSession to match what APIs are expecting
export const getServerSession = getSession;