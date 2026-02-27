import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { entryId } = await params;
    const body = await request.json();
    const { term, aliases, value, notes } = body;

    const updateData: any = {};
    if (term !== undefined) updateData.term = term;
    if (aliases !== undefined) updateData.aliases = aliases ? JSON.stringify(aliases) : null;
    if (value !== undefined) updateData.value = value;
    if (notes !== undefined) updateData.notes = notes || null;

    const entry = await prisma.datasourceDictionaryEntry.update({
      where: { id: entryId },
      data: updateData,
    });

    return NextResponse.json({ entry });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { entryId } = await params;

    await prisma.datasourceDictionaryEntry.delete({
      where: { id: entryId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
