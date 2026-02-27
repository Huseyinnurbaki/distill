import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { resolveBranchToSha } from '@/lib/git';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const { leftBranch, rightBranch, title, personaId } = await request.json();

    if (!leftBranch || !rightBranch) {
      return NextResponse.json(
        { error: 'Both branches are required' },
        { status: 400 }
      );
    }

    const repo = await prisma.repo.findFirst({
      where: {
        id,
        userId: user.userId,
      },
    });

    if (!repo) {
      return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
    }

    const leftCommitSha = await resolveBranchToSha(repo.id, leftBranch);
    const rightCommitSha = await resolveBranchToSha(repo.id, rightBranch);

    // Resolve persona
    let personaName: string | null = null;
    let personaDescription: string | null = null;
    if (personaId) {
      const persona = await prisma.persona.findUnique({ where: { id: personaId } });
      if (persona) {
        personaName = persona.name;
        personaDescription = persona.description;
      }
    } else {
      const defaultPersona = await prisma.persona.findFirst({ where: { isDefault: true } });
      if (defaultPersona) {
        personaName = defaultPersona.name;
        personaDescription = defaultPersona.description;
      }
    }

    const chat = await prisma.chat.create({
      data: {
        type: 'COMPARE',
        title: title || `Compare ${leftBranch} ↔ ${rightBranch}`,
        leftBranch,
        leftCommitSha,
        rightBranch,
        rightCommitSha,
        personaName,
        personaDescription,
        repoId: repo.id,
        userId: user.userId,
      },
    });

    return NextResponse.json({ chat });
  } catch (error: any) {
    console.error('Create compare chat error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
