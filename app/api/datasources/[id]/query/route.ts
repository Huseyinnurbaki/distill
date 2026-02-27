import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { decrypt } from '@/lib/encrypt';
import { executeQuery } from '@/lib/datasource';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Check access: admin OR in DatasourceAccess
    let canExecute = user.isAdmin;
    if (!canExecute) {
      const access = await prisma.datasourceAccess.findUnique({
        where: { datasourceId_userId: { datasourceId: id, userId: user.userId } },
      });
      canExecute = !!access;
    }

    if (!canExecute) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const datasource = await prisma.datasource.findUnique({
      where: { id },
    });

    if (!datasource) {
      return NextResponse.json({ error: 'Datasource not found' }, { status: 404 });
    }

    const { sql } = await request.json();
    if (!sql) {
      return NextResponse.json({ error: 'sql is required' }, { status: 400 });
    }

    const connString = decrypt(datasource.encryptedConnString);
    const result = await executeQuery(connString, sql);

    return NextResponse.json({ ...result, sql });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Query failed' }, { status: 500 });
  }
}
