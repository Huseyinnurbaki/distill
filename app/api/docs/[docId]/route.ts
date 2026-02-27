import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const user = await requireAuth();
    const { docId } = await params;

    const doc = await prisma.doc.findFirst({
      where: {
        id: docId,
        userId: user.userId,
      },
      include: {
        versions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        repo: true,
      },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
    }

    return NextResponse.json({ doc });
  } catch (error: any) {
    console.error('Get doc error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const user = await requireAuth();
    const { docId } = await params;

    const { title, status } = await request.json();

    const doc = await prisma.doc.findFirst({
      where: {
        id: docId,
        userId: user.userId,
      },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
    }

    const updatedDoc = await prisma.doc.update({
      where: { id: doc.id },
      data: {
        ...(title && { title }),
        ...(status && { status }),
      },
      include: {
        versions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    return NextResponse.json({ doc: updatedDoc });
  } catch (error: any) {
    console.error('Update doc error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
