import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { resolveBranchToSha } from '@/lib/git';

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

    const chats = await prisma.chat.findMany({
      where: {
        repoId: repo.id,
        userId: user.userId,
      },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json({ chats });
  } catch (error: any) {
    console.error('List chats error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const { branch, title, includeContext = true, personaId } = await request.json();

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch is required' },
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

    // Find first datasource assigned to this repo+branch
    const firstAssignment = await prisma.datasourceAssignment.findFirst({
      where: { repoId: repo.id, branch },
      orderBy: { id: 'asc' },
    });

    const chat = await prisma.chat.create({
      data: {
        type: 'SNAPSHOT',
        title: title || `Chat on ${branch}`,
        branch,
        commitSha,
        includeContext,
        personaName,
        personaDescription,
        activeDatasourceId: firstAssignment?.datasourceId ?? null,
        repoId: repo.id,
        userId: user.userId,
      },
    });

    return NextResponse.json({ chat });
  } catch (error: any) {
    console.error('Create chat error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
