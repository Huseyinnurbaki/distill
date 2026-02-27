import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function GET() {
  try {
    const user = await requireAuth();
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const personas = await prisma.persona.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ personas });
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

    const body = await request.json();
    const { name, description, isDefault, technicalDepth, codeExamples, assumedKnowledge, businessContext, responseDetail } = body;

    if (!name || !description) {
      return NextResponse.json({ error: 'Name and description are required' }, { status: 400 });
    }

    if (isDefault) {
      await prisma.persona.updateMany({ data: { isDefault: false } });
    }

    const persona = await prisma.persona.create({
      data: {
        name,
        description,
        isDefault: isDefault ?? false,
        technicalDepth: technicalDepth ?? 3,
        codeExamples: codeExamples ?? 3,
        assumedKnowledge: assumedKnowledge ?? 3,
        businessContext: businessContext ?? 3,
        responseDetail: responseDetail ?? 3,
      },
    });

    return NextResponse.json({ persona });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
