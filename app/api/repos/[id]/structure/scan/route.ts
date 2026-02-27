import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { parseDistillConfig, resolveBranchToSha, getFileLastCommit, readFile } from '@/lib/git';
import { scanRouting, scanSchema, getDirectoryLastCommit } from '@/lib/structure';
import { callAI } from '@/lib/ai';
import type { AIProvider } from '@/lib/ai';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { force } = await request.json().catch(() => ({ force: false }));

    const repo = await prisma.repo.findFirst({
      where: {
        id,
        OR: [{ userId: user.userId }, { isGlobal: true }],
      },
    });

    if (!repo) {
      return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
    }

    const commitSha = await resolveBranchToSha(repo.id, repo.defaultBranch);
    const config = await parseDistillConfig(repo.id, commitSha);

    if (!config?.structure) {
      return NextResponse.json(
        { error: 'No structure config found in .distill.yaml' },
        { status: 400 }
      );
    }

    // Pick AI provider/model from admin settings, falling back to env-based defaults
    let aiProvider: AIProvider | null = null;
    let aiModel: string | null = null;
    try {
      const settings = await prisma.setting.findMany({
        where: { key: { in: ['defaultOpenAIModel', 'defaultAnthropicModel'] } },
      });
      const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
      const isOSeries = (m: string) => /^o\d/.test(m);
      if (settingsMap.defaultOpenAIModel && process.env.OPENAI_API_KEY && !isOSeries(settingsMap.defaultOpenAIModel)) {
        aiProvider = 'openai';
        aiModel = settingsMap.defaultOpenAIModel;
      } else if (settingsMap.defaultAnthropicModel && process.env.ANTHROPIC_API_KEY) {
        aiProvider = 'anthropic';
        aiModel = settingsMap.defaultAnthropicModel;
      } else if (process.env.OPENAI_API_KEY) {
        aiProvider = 'openai';
        aiModel = 'gpt-4o-mini';
      } else if (process.env.ANTHROPIC_API_KEY) {
        aiProvider = 'anthropic';
        aiModel = 'claude-haiku-4-5-20251001';
      }
    } catch {
      // proceed without descriptions
    }

    const results = [];
    const warnings: string[] = [];
    const activeSources: Array<{ type: string; source: string }> = [];

    // Scan routing
    const routingConfig = config.structure.frontend?.routing;
    if (routingConfig) {
      const source = routingConfig.directory ?? routingConfig.routes_file ?? '';
      activeSources.push({ type: 'routing', source });
      try {
        const data = await scanRouting(repo.id, commitSha, routingConfig);

        if (routingConfig.directory && (!data.routes || data.routes.length === 0)) {
          warnings.push(`No page files found in directory "${routingConfig.directory}"`);
        }

        const sourceCommit = routingConfig.directory
          ? (await getDirectoryLastCommit(repo.id, repo.defaultBranch, routingConfig.directory)) ?? commitSha
          : routingConfig.routes_file
          ? (await getFileLastCommit(repo.id, repo.defaultBranch, routingConfig.routes_file)) ?? commitSha
          : commitSha;

        const existing = await prisma.repoStructure.findUnique({
          where: { repoId_type_source: { repoId: repo.id, type: 'routing', source } },
        });
        const sourceChanged = !existing || existing.commitSha !== sourceCommit;

        // Always carry over any existing descriptions first
        if (existing) {
          const existingData = JSON.parse(existing.data);
          const descMap = Object.fromEntries(
            (existingData.routes ?? [])
              .filter((r: { path: string; description?: string }) => r.description)
              .map((r: { path: string; description?: string }) => [r.path, r.description])
          );
          data.routes?.forEach((route) => {
            if (descMap[route.path]) route.description = descMap[route.path];
          });
        }

        // Generate AI descriptions: all routes on source change/force, only missing ones otherwise
        if (aiProvider && aiModel && data.routes?.length) {
          const routesToDescribe = (sourceChanged || force)
            ? data.routes
            : (data.routes ?? []).filter((r) => !r.description);

          if (routesToDescribe.length > 0) {
            await Promise.all(
              routesToDescribe.map(async (route) => {
                try {
                  const content = await readFile(repo.id, commitSha, route.file);
                  route.description = await callAI(aiProvider!, aiModel!, [
                    {
                      role: 'system',
                      content: 'You are a code analyser. Reply with ONLY a plain-English description of what this page is for — one sentence, max 10 words, no code, no punctuation at the end.',
                    },
                    {
                      role: 'user',
                      content: `Route: ${route.path}\nFile: ${route.file}\n\n${content.slice(0, 1500)}`,
                    },
                  ], 30);
                } catch (err: any) {
                  warnings.push(`AI description skipped for ${route.path}: ${err.message}`);
                }
              })
            );
          }
        }

        const record = await prisma.repoStructure.upsert({
          where: { repoId_type_source: { repoId: repo.id, type: 'routing', source } },
          update: { data: JSON.stringify(data), commitSha: sourceCommit },
          create: {
            repoId: repo.id,
            type: 'routing',
            source,
            data: JSON.stringify(data),
            commitSha: sourceCommit,
          },
        });
        results.push(record);
      } catch (err: any) {
        warnings.push(`Could not scan routing source "${source}": ${err.message}`);
      }
    }

    // Scan database schemas
    const schemaPaths = config.structure.database?.schemas ?? [];
    for (const schemaPath of schemaPaths) {
      activeSources.push({ type: 'schema', source: schemaPath });
      try {
        const data = await scanSchema(repo.id, commitSha, schemaPath);
        const sourceCommit =
          (await getFileLastCommit(repo.id, repo.defaultBranch, schemaPath)) ?? commitSha;

        const record = await prisma.repoStructure.upsert({
          where: { repoId_type_source: { repoId: repo.id, type: 'schema', source: schemaPath } },
          update: { data: JSON.stringify(data), commitSha: sourceCommit },
          create: {
            repoId: repo.id,
            type: 'schema',
            source: schemaPath,
            data: JSON.stringify(data),
            commitSha: sourceCommit,
          },
        });
        results.push(record);
      } catch (err: any) {
        warnings.push(`Could not scan schema "${schemaPath}": ${err.message}`);
      }
    }

    // Delete any records whose source is no longer in the current config
    if (activeSources.length > 0) {
      await prisma.repoStructure.deleteMany({
        where: {
          repoId: repo.id,
          NOT: { OR: activeSources.map((s) => ({ type: s.type, source: s.source })) },
        },
      });
    } else {
      await prisma.repoStructure.deleteMany({ where: { repoId: repo.id } });
    }

    return NextResponse.json({ success: true, structures: results, warnings });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to scan structures' },
      { status: 500 }
    );
  }
}
