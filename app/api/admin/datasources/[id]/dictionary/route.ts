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

    const entries = await prisma.datasourceDictionaryEntry.findMany({
      where: { datasourceId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ entries });
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
    const { term, aliases, value, notes } = await request.json();

    if (!term || !value) {
      return NextResponse.json({ error: 'Term and value are required' }, { status: 400 });
    }

    const entry = await prisma.datasourceDictionaryEntry.create({
      data: {
        datasourceId: id,
        term,
        aliases: aliases ? JSON.stringify(aliases) : null,
        value,
        notes: notes || null,
      },
    });

    return NextResponse.json({ entry });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
