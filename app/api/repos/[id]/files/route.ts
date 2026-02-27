import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { listFiles, resolveBranchToSha } from '@/lib/git';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');
    const all = searchParams.get('all') === 'true';

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

    const commitSha = await resolveBranchToSha(repo.id, branch);
    const allFiles = await listFiles(repo.id, commitSha);

    if (all) {
      // Return all files
      const files = allFiles.map((path) => ({
        path,
        type: 'file',
      }));
      return NextResponse.json({ files });
    }

    // Filter for markdown files only
    const markdownFiles = allFiles
      .filter(
        (file) =>
          file.endsWith('.md') ||
          file.endsWith('.markdown') ||
          file.endsWith('.mdx')
      )
      .map((path) => ({
        path,
        type: 'markdown',
      }));

    return NextResponse.json({ files: markdownFiles });
  } catch (error: any) {
    console.error('List files error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
