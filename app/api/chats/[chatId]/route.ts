import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await requireAuth();
    const { chatId } = await params;

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user.userId },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    await prisma.chat.delete({ where: { id: chatId } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await requireAuth();
    const { chatId } = await params;
    const body = await request.json();
    const { personaName, personaDescription, activeDatasourceId } = body;

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: user.userId },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (personaName !== undefined) updateData.personaName = personaName;
    if (personaDescription !== undefined) updateData.personaDescription = personaDescription;
    if (activeDatasourceId !== undefined) updateData.activeDatasourceId = activeDatasourceId;

    const updated = await prisma.chat.update({
      where: { id: chatId },
      data: updateData,
    });

    return NextResponse.json({ chat: updated });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
