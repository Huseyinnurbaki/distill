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

    console.log('Fetching docs for repo:', repo.id, 'branch:', branch);

    const commitSha = await resolveBranchToSha(repo.id, branch);
    console.log('Resolved commit SHA:', commitSha);

    const allFiles = await listFiles(repo.id, commitSha);
    console.log('Total files found:', allFiles.length);

    // Filter for markdown files recursively, excluding hidden directories (starting with .)
    const markdownFiles = allFiles
      .filter((file) => {
        // Check if file is markdown
        const isMarkdown = file.endsWith('.md') || file.endsWith('.markdown') || file.endsWith('.mdx');
        if (!isMarkdown) return false;

        // Check if any directory in the path starts with .
        const pathParts = file.split('/');
        const hasHiddenDir = pathParts.some((part, index) => {
          // Only check directories (not the filename itself)
          return index < pathParts.length - 1 && part.startsWith('.');
        });

        return !hasHiddenDir;
      })
      .map((path) => ({
        path,
        type: 'markdown',
      }));

    console.log('Markdown files found (excluding hidden dirs):', markdownFiles.length);

    return NextResponse.json({ files: markdownFiles });
  } catch (error: any) {
    console.error('List docs error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
