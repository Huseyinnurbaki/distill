import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminUser = await requireAdmin();
    const { userId } = await params;

    const { isAdmin } = await request.json();

    if (typeof isAdmin !== 'boolean') {
      return NextResponse.json({ error: 'isAdmin must be a boolean' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (target.id === adminUser.userId) {
      return NextResponse.json({ error: 'Cannot change your own admin status' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Toggle admin error:', error);

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
