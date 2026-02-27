import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await requireAuth();
    const { chatId } = await params;

    const { includeContext } = await request.json();

    if (typeof includeContext !== 'boolean') {
      return NextResponse.json(
        { error: 'includeContext must be a boolean' },
        { status: 400 }
      );
    }

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId: user.userId,
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const updatedChat = await prisma.chat.update({
      where: { id: chat.id },
      data: { includeContext },
    });

    return NextResponse.json({ chat: updatedChat });
  } catch (error: any) {
    console.error('Update chat context error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
