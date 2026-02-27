import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const repo = await prisma.repo.findFirst({
      where: {
        id,
        OR: [{ userId: user.userId }, { isGlobal: true }],
      },
    });

    if (!repo) {
      return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
    }

    const structures = await prisma.repoStructure.findMany({
      where: { repoId: repo.id },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ structures });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to get structures' },
      { status: 500 }
    );
  }
}
