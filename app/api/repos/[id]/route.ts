import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const repo = await prisma.repo.findFirst({
      where: {
        id,
        OR: [
          { userId: user.userId },  // User's own repo
          { isGlobal: true },       // Global repo
        ],
      },
      include: {
        _count: {
          select: {
            chats: true,
            docs: true,
          },
        },
      },
    });

    if (!repo) {
      return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
    }

    const repoData = {
      ...repo,
      encryptedToken: undefined,
    };

    return NextResponse.json({ repo: repoData });
  } catch (error: any) {
    console.error('Get repo error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { isGlobal } = await request.json();

    if (typeof isGlobal !== 'boolean') {
      return NextResponse.json(
        { error: 'isGlobal must be a boolean' },
        { status: 400 }
      );
    }

    // Only the owner can change global status
    const repo = await prisma.repo.findFirst({
      where: {
        id,
        userId: user.userId,
      },
    });

    if (!repo) {
      return NextResponse.json(
        { error: 'Repo not found or you do not have permission' },
        { status: 404 }
      );
    }

    const updatedRepo = await prisma.repo.update({
      where: { id: repo.id },
      data: { isGlobal },
    });

    return NextResponse.json({ repo: updatedRepo });
  } catch (error: any) {
    console.error('Update repo error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
