import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import {
  fetchMirror,
  detectDefaultBranch,
  parseDistillConfig,
  buildRepoContext,
  resolveBranchToSha,
  getFileLastCommit,
} from '@/lib/git';
import { introspectPostgres } from '@/lib/datasource';
import { decrypt } from '@/lib/encrypt';
import { scanRouting, scanSchema, getDirectoryLastCommit } from '@/lib/structure';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const repo = await prisma.repo.findFirst({
      where: {
        id,
        OR: [
          { userId: user.userId },
          { isGlobal: true },
        ],
      },
    });

    if (!repo) {
      return NextResponse.json({ error: 'Repo not found' }, { status: 404 });
    }

    await fetchMirror(repo.id, repo.url, repo.encryptedToken || undefined);

    // Detect and update the default branch
    const defaultBranch = await detectDefaultBranch(repo.id);

    // Parse .distill.yaml and build context if it exists
    let aiContext: string | null = null;
    let contextFileCommits: string | null = null;
    let contextUpdatedAt: Date | null = null;

    try {
      const commitSha = await resolveBranchToSha(repo.id, defaultBranch);
      const config = await parseDistillConfig(repo.id, commitSha);

      if (config) {
        // Check if we need to rebuild context
        const { context, fileCommits } = await buildRepoContext(
          repo.id,
          defaultBranch,
          config
        );

        const newFileCommits = JSON.stringify(fileCommits);

        // Only update if commits changed or no context exists
        if (!repo.contextFileCommits || repo.contextFileCommits !== newFileCommits) {
          aiContext = context;
          contextFileCommits = newFileCommits;
          contextUpdatedAt = new Date();
          console.log('Context rebuilt - files changed');
        } else {
          console.log('Context files unchanged - skipping rebuild');
        }
      }
    } catch (error: any) {
      console.log('No .distill.yaml found or error parsing, skipping context build');
    }

    await prisma.repo.update({
      where: { id: repo.id },
      data: {
        lastFetchedAt: new Date(),
        defaultBranch: defaultBranch,
        ...(aiContext !== null && {
          aiContext,
          contextFileCommits,
          contextUpdatedAt,
        }),
      },
    });

    // Incrementally update structure if .distill.yaml has a structure section
    try {
      const commitSha = await resolveBranchToSha(repo.id, defaultBranch);
      const config = await parseDistillConfig(repo.id, commitSha);

      // Build the set of sources the current config expects
      const activeSources: Array<{ type: string; source: string }> = [];

      if (config?.structure) {
        const routingConfig = config.structure.frontend?.routing;
        if (routingConfig) {
          const source = routingConfig.directory ?? routingConfig.routes_file ?? '';
          activeSources.push({ type: 'routing', source });
          const sourceCommit = routingConfig.directory
            ? (await getDirectoryLastCommit(repo.id, defaultBranch, routingConfig.directory)) ?? commitSha
            : routingConfig.routes_file
            ? (await getFileLastCommit(repo.id, defaultBranch, routingConfig.routes_file)) ?? commitSha
            : commitSha;

          const existing = await prisma.repoStructure.findUnique({
            where: { repoId_type_source: { repoId: repo.id, type: 'routing', source } },
          });

          if (!existing || existing.commitSha !== sourceCommit) {
            const data = await scanRouting(repo.id, commitSha, routingConfig);
            await prisma.repoStructure.upsert({
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
          }
        }

        for (const schemaPath of config.structure.database?.schemas ?? []) {
          activeSources.push({ type: 'schema', source: schemaPath });
          try {
            const sourceCommit =
              (await getFileLastCommit(repo.id, defaultBranch, schemaPath)) ?? commitSha;
            const existing = await prisma.repoStructure.findUnique({
              where: { repoId_type_source: { repoId: repo.id, type: 'schema', source: schemaPath } },
            });

            if (!existing || existing.commitSha !== sourceCommit) {
              const data = await scanSchema(repo.id, commitSha, schemaPath);
              await prisma.repoStructure.upsert({
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
            }
          } catch (err: any) {
            console.error(`Structure scan skipped for ${schemaPath}:`, err.message);
          }
        }
      }

      // Delete any records whose source is no longer in the config
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
    } catch (err: any) {
      console.log('Structure scan skipped:', err.message);
    }

    // Re-introspect all datasources assigned to any branch of this repo
    try {
      const assignments = await prisma.datasourceAssignment.findMany({
        where: { repoId: repo.id },
        include: { datasource: true },
      });
      const seenDatasourceIds = new Set<string>();
      for (const a of assignments) {
        if (seenDatasourceIds.has(a.datasourceId)) continue;
        seenDatasourceIds.add(a.datasourceId);
        try {
          const connString = decrypt(a.datasource.encryptedConnString);
          const cachedSchema = await introspectPostgres(connString);
          await prisma.datasource.update({
            where: { id: a.datasourceId },
            data: { cachedSchema, schemaUpdatedAt: new Date() },
          });
        } catch (err: any) {
          console.error(`Datasource introspection skipped for ${a.datasourceId}:`, err.message);
        }
      }
    } catch (err: any) {
      console.log('Datasource re-introspection skipped:', err.message);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Pull repo error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to pull repository' },
      { status: 500 }
    );
  }
}
