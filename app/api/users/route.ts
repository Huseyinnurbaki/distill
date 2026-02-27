import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/bcrypt';
import { requireAdmin } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { username, email, password, isAdmin } = await request.json();

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username or email already exists' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        authProvider: 'local',
        isAdmin: isAdmin || false,
        isActive: true,  // Admin-created users are active immediately
      },
      select: {
        id: true,
        username: true,
        email: true,
        authProvider: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Create user error:', error);

    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === 'Unauthorized' ? 401 : 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        authProvider: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        _count: { select: { chats: true } },
      },
      orderBy: [
        { isActive: 'asc' },  // Pending users first
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('List users error:', error);

    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === 'Unauthorized' ? 401 : 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
