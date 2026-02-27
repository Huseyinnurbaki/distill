import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const user = await requireAuth();
    const { docId } = await params;

    const { content } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const doc = await prisma.doc.findFirst({
      where: {
        id: docId,
        userId: user.userId,
      },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
    }

    const version = await prisma.docVersion.create({
      data: {
        content,
        docId: doc.id,
      },
    });

    await prisma.doc.update({
      where: { id: doc.id },
      data: {
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ version });
  } catch (error: any) {
    console.error('Create doc version error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
