import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';

export interface SessionData {
  userId: string;
  username: string;
  isAdmin: boolean;
}

const sessionOptions: SessionOptions = {
  password: process.env.DISTILL_SECRET_KEY || 'complex_password_at_least_32_characters_long',
  cookieName: 'distill_session',
  cookieOptions: {
    secure: process.env.DISTILL_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getCurrentUser(): Promise<SessionData | null> {
  // Check iron-session first (username/password login)
  const session = await getSession();
  if (session.userId) {
    return session;
  }

  // Fall back to NextAuth session (Google login)
  const nextAuthSession = await auth();
  if (nextAuthSession?.user?.id) {
    return {
      userId: nextAuthSession.user.id,
      username: nextAuthSession.user.username,
      isAdmin: nextAuthSession.user.isAdmin ?? false,
    };
  }

  return null;
}

export async function requireAuth(): Promise<SessionData> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireAdmin(): Promise<SessionData> {
  const user = await requireAuth();
  if (!user.isAdmin) {
    throw new Error('Forbidden');
  }
  return user;
}
