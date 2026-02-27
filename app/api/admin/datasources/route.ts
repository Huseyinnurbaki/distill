import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { encrypt } from '@/lib/encrypt';

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const datasources = await prisma.datasource.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        cachedSchema: true,
        schemaUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ datasources });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, connString } = await request.json();

    if (!name || !connString) {
      return NextResponse.json({ error: 'Name and connection string are required' }, { status: 400 });
    }

    const datasource = await prisma.datasource.create({
      data: {
        name,
        type: 'postgres',
        encryptedConnString: encrypt(connString),
      },
      select: {
        id: true,
        name: true,
        type: true,
        schemaUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ datasource });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
