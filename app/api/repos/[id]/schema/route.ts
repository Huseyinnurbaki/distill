import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { parseDistillConfig, resolveBranchToSha } from '@/lib/git';
import { scanSchema } from '@/lib/structure';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const branch = request.nextUrl.searchParams.get('branch');

    const repo = await prisma.repo.findFirst({
      where: {
        id,
        OR: [{ userId: user.userId }, { isGlobal: true }],
      },
    });

    if (!repo) {
      return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
    }

    const targetBranch = branch || repo.defaultBranch;
    const commitSha = await resolveBranchToSha(repo.id, targetBranch);
    const config = await parseDistillConfig(repo.id, commitSha);
    const schemaPaths = config?.structure?.database?.schemas ?? [];

    if (schemaPaths.length === 0) {
      return NextResponse.json({ schemas: [] });
    }

    const schemas = await Promise.all(
      schemaPaths.map(async (source) => {
        try {
          const data = await scanSchema(repo.id, commitSha, source);
          return { source, data };
        } catch (err: any) {
          return { source, error: err.message };
        }
      })
    );

    return NextResponse.json({ schemas, branch: targetBranch, commitSha });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to load schema' },
      { status: 500 }
    );
  }
}
