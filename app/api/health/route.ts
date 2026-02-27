import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      filesystem: 'unknown',
    },
  };

  try {
    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.checks.database = 'ok';
    } catch (error) {
      checks.checks.database = 'error';
      checks.status = 'unhealthy';
    }

    // Check filesystem access
    try {
      const dataPath = process.env.DISTILL_GIT_BASE_PATH || '/data/repos';
      await fs.access(path.dirname(dataPath));
      checks.checks.filesystem = 'ok';
    } catch (error) {
      checks.checks.filesystem = 'error';
      checks.status = 'unhealthy';
    }

    return NextResponse.json(checks, {
      status: checks.status === 'healthy' ? 200 : 503,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 503 }
    );
  }
}
