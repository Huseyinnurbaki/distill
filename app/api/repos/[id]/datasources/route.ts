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
    const branch = request.nextUrl.searchParams.get('branch');

    if (!branch) {
      return NextResponse.json({ error: 'branch query param required' }, { status: 400 });
    }

    const repo = await prisma.repo.findFirst({
      where: {
        id,
        OR: [{ userId: user.userId }, { isGlobal: true }],
      },
    });

    if (!repo) {
      return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
    }

    const assignments = await prisma.datasourceAssignment.findMany({
      where: { repoId: id, branch },
      include: { datasource: { select: { id: true, name: true, type: true } } },
    });

    const datasources = await Promise.all(
      assignments.map(async (a) => {
        let canExecute = user.isAdmin;
        if (!canExecute) {
          const access = await prisma.datasourceAccess.findUnique({
            where: { datasourceId_userId: { datasourceId: a.datasourceId, userId: user.userId } },
          });
          canExecute = !!access;
        }
        return {
          id: a.datasource.id,
          name: a.datasource.name,
          type: a.datasource.type,
          canExecute,
        };
      })
    );

    return NextResponse.json({ datasources });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
