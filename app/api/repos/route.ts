import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import {
  cloneMirror,
  detectDefaultBranch,
  ensureGitBasePath,
  parseDistillConfig,
  buildRepoContext,
  resolveBranchToSha,
} from '@/lib/git';

export async function GET() {
  try {
    const user = await requireAuth();

    const repos = await prisma.repo.findMany({
      where: {
        OR: [
          { userId: user.userId },  // User's own repos
          { isGlobal: true },       // Global repos (shared)
        ],
      },
      select: {
        id: true,
        name: true,
        url: true,
        defaultBranch: true,
        lastFetchedAt: true,
        contextUpdatedAt: true,
        contextFileCommits: true,
        pullIntervalMinutes: true,
        accessType: true,
        isGlobal: true,
        userId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ repos });
  } catch (error: any) {
    console.error('List repos error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { name, url, accessType, token, pullIntervalMinutes, defaultBranch, isGlobal } =
      await request.json();

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      );
    }

    if (!url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Only HTTPS URLs are allowed' },
        { status: 400 }
      );
    }

    await ensureGitBasePath();

    // Check if repo with this URL already exists
    const existingRepo = await prisma.repo.findFirst({
      where: { url },
    });

    if (existingRepo) {
      return NextResponse.json(
        { error: 'A repository with this URL already exists' },
        { status: 409 }
      );
    }

    const repo = await prisma.repo.create({
      data: {
        name,
        url,
        accessType: accessType || 'public',
        encryptedToken: token || null,
        pullIntervalMinutes: pullIntervalMinutes || 10,
        defaultBranch: defaultBranch || 'main',
        isGlobal: isGlobal || false,
        userId: user.userId,
      },
    });

    try {
      await cloneMirror(repo.id, url, token);

      let detectedBranch = repo.defaultBranch;
      if (!defaultBranch) {
        try {
          detectedBranch = await detectDefaultBranch(repo.id);
        } catch {
          detectedBranch = 'main';
        }
      }

      // Process .distill.yaml if present (same as pull flow)
      let aiContext: string | null = null;
      let contextFileCommits: string | null = null;
      let contextUpdatedAt: Date | null = null;
      try {
        const commitSha = await resolveBranchToSha(repo.id, detectedBranch);
        const config = await parseDistillConfig(repo.id, commitSha);
        if (config) {
          const { context, fileCommits } = await buildRepoContext(repo.id, detectedBranch, config);
          aiContext = context;
          contextFileCommits = JSON.stringify(fileCommits);
          contextUpdatedAt = new Date();
        }
      } catch {
        // No .distill.yaml or error parsing — skip context build
      }

      await prisma.repo.update({
        where: { id: repo.id },
        data: {
          defaultBranch: detectedBranch,
          lastFetchedAt: new Date(),
          ...(aiContext !== null && { aiContext, contextFileCommits, contextUpdatedAt }),
        },
      });

      return NextResponse.json({
        repo: { ...repo, defaultBranch: detectedBranch },
      });
    } catch (error: any) {
      await prisma.repo.delete({ where: { id: repo.id } });
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  } catch (error: any) {
    console.error('Create repo error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
