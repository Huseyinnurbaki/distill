import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const SETTING_KEYS = ['defaultOpenAIModel', 'defaultAnthropicModel'] as const;

export async function GET() {
  try {
    await requireAdmin();

    const rows = await prisma.setting.findMany({
      where: { key: { in: [...SETTING_KEYS] } },
    });

    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return NextResponse.json({ settings });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();

    for (const key of SETTING_KEYS) {
      if (typeof body[key] === 'string' && body[key].trim()) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: body[key].trim() },
          create: { key, value: body[key].trim() },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
