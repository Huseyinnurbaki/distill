import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { listBranches, resolveBranchToSha, parseDistillConfig, detectDefaultBranch, GitConfig } from '@/lib/git';
import minimatch from 'minimatch';

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
          { userId: user.userId },
          { isGlobal: true },
        ],
      },
    });

    if (!repo) {
      return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
    }

    const branches = await listBranches(repo.id);

    const branchesWithSha = await Promise.all(
      branches.map(async (branch) => {
        try {
          const sha = await resolveBranchToSha(repo.id, branch);
          return { branch, sha };
        } catch {
          return { branch, sha: null };
        }
      })
    );

    // Parse .distill.yaml for branch configuration
    let config: GitConfig | null = null;
    try {
      const commitSha = await resolveBranchToSha(repo.id, repo.defaultBranch);
      config = await parseDistillConfig(repo.id, commitSha);
    } catch {
      // No config file, use defaults
    }

    // Filter branches based on ignore patterns
    let filteredBranches = branchesWithSha;
    if (config?.branches?.ignore && config.branches.ignore.length > 0) {
      const ignorePatterns = config.branches.ignore;
      filteredBranches = branchesWithSha.filter(b =>
        !ignorePatterns.some((pattern: string) => minimatch(b.branch, pattern))
      );
    }

    // Get primary branch (main or master)
    const primaryBranch = await detectDefaultBranch(repo.id).catch(() => null);

    // Sort branches: primary, important, then rest
    const sortedBranches = filteredBranches.sort((a, b) => {
      // 1. Primary branch first
      if (a.branch === primaryBranch) return -1;
      if (b.branch === primaryBranch) return 1;

      // 2. Important branches (from yaml) in specified order
      const importantBranches = config?.branches?.important || [];
      const aImportantIndex = importantBranches.indexOf(a.branch);
      const bImportantIndex = importantBranches.indexOf(b.branch);

      if (aImportantIndex !== -1 && bImportantIndex !== -1) {
        return aImportantIndex - bImportantIndex;
      }
      if (aImportantIndex !== -1) return -1;
      if (bImportantIndex !== -1) return 1;

      // 3. Rest alphabetically
      return a.branch.localeCompare(b.branch);
    });

    return NextResponse.json({ branches: sortedBranches });
  } catch (error: any) {
    console.error('List branches error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
