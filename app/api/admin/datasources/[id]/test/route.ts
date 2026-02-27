import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { decrypt } from '@/lib/encrypt';
import { Client } from 'pg';

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
    const client = new Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });

    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      try { await client.end(); } catch { }
      return NextResponse.json({ ok: false, error: err.message });
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
