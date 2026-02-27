import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const assignments = await prisma.datasourceAssignment.findMany({
      where: { datasourceId: id },
      include: { repo: { select: { id: true, name: true } } },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json({ assignments });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { repoId, branch } = await request.json();

    if (!repoId || !branch) {
      return NextResponse.json({ error: 'repoId and branch are required' }, { status: 400 });
    }

    const assignment = await prisma.datasourceAssignment.create({
      data: { datasourceId: id, repoId, branch },
      include: { repo: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ assignment });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Assignment already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
