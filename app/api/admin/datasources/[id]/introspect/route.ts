import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { decrypt } from '@/lib/encrypt';
import { introspectPostgres } from '@/lib/datasource';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const datasource = await prisma.datasource.findUnique({
      where: { id },
    });

    if (!datasource) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const connString = decrypt(datasource.encryptedConnString);
    const cachedSchema = await introspectPostgres(connString);

    const updated = await prisma.datasource.update({
      where: { id },
      data: { cachedSchema, schemaUpdatedAt: new Date() },
      select: { id: true, schemaUpdatedAt: true },
    });

    return NextResponse.json({ ok: true, schemaUpdatedAt: updated.schemaUpdatedAt });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
