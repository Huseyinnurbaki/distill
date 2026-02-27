import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { readFile, resolveBranchToSha } from '@/lib/git';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    const user = await requireAuth();
    const { id, path } = await params;
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch parameter is required' },
        { status: 400 }
      );
    }

    const repo = await prisma.repo.findFirst({
      where: {
        id,
        OR: [
          { userId: user.userId },
          { isGlobal: true },
        ],
      },
    });

    if (!repo) {
      return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
    }

    const filePath = path.join('/');
    const commitSha = await resolveBranchToSha(repo.id, branch);
    const content = await readFile(repo.id, commitSha, filePath);

    return NextResponse.json({ content, path: filePath });
  } catch (error: any) {
    console.error('Read file error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
