import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { streamAIResponse, AIProvider } from '@/lib/ai';
import { readFile, listFiles, resolveBranchToSha } from '@/lib/git';
import { bustModelCache } from '@/lib/model-cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await requireAuth();
    const { chatId } = await params;

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId: user.userId,
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: {
        chatId: chat.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('List messages error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await requireAuth();
    const { chatId } = await params;

    const { content, provider, model } = await request.json();

    if (!content || !provider || !model) {
      return NextResponse.json(
        { error: 'Content, provider, and model are required' },
        { status: 400 }
      );
    }

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId: user.userId,
      },
      include: {
        repo: true,
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    await prisma.message.create({
      data: {
        role: 'user',
        content,
        chatId: chat.id,
        userId: user.userId,
      },
    });

    // Get file tree for context
    let fileTreeContext = '';
    try {
      const commitSha = await resolveBranchToSha(chat.repo.id, chat.branch ?? 'main');
      const allFiles = await listFiles(chat.repo.id, commitSha);
      fileTreeContext = buildFileTreeContext(allFiles);
    } catch (error) {
      console.error('Failed to build file tree context:', error);
    }

    // Build datasource context if active
    let datasourceSection = '';
    if (chat.activeDatasourceId) {
      try {
        const ds = await prisma.datasource.findUnique({
          where: { id: chat.activeDatasourceId },
          include: { dictionary: true },
        });
        if (ds) {
          datasourceSection = buildDatasourceSection(ds, ds.dictionary);
        }
      } catch (e) {
        console.error('Failed to build datasource context:', e);
      }
    }

    // Only include repository context on FIRST message (optimization)
    const isFirstMessage = chat.messages.length === 0;
    const systemPrompt = buildSystemPrompt(chat, fileTreeContext, isFirstMessage, datasourceSection);

    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...chat.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content },
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';

          for await (const chunk of streamAIResponse(
            provider as AIProvider,
            model,
            aiMessages
          )) {
            if (chunk.content) {
              fullResponse += chunk.content;
              const data = `data: ${JSON.stringify({ content: chunk.content })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }

            if (chunk.done) {
              await prisma.message.create({
                data: {
                  role: 'assistant',
                  content: fullResponse,
                  model,
                  provider,
                  chatId: chat.id,
                  userId: user.userId,
                },
              });

              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          }
        } catch (error: any) {
          console.error('AI streaming error:', error);
          const isNotChatModel =
            error.message?.includes('not a chat model') ||
            error.message?.includes('v1/chat/completions');
          if (isNotChatModel) bustModelCache(provider);
          const errorData = `data: ${JSON.stringify({
            error: isNotChatModel
              ? `⚠️ **${model}** is not a chat model and cannot be used here. Please switch to a different model — this one will be removed from the list soon.`
              : error.message,
          })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Send message error:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildFileTreeContext(files: string[]): string {
  // Group files by directory
  const tree: { [key: string]: string[] } = {};

  files.forEach(file => {
    const parts = file.split('/');
    if (parts.length === 1) {
      // Root level file
      if (!tree['(root)']) tree['(root)'] = [];
      tree['(root)'].push(file);
    } else {
      // File in directory
      const dir = parts.slice(0, -1).join('/');
      if (!tree[dir]) tree[dir] = [];
      tree[dir].push(parts[parts.length - 1]);
    }
  });

  // Build a concise representation
  const dirs = Object.keys(tree).sort();
  let output = '\n\nRepository Structure:\n';

  for (const dir of dirs) {
    if (dir === '(root)') {
      output += `Root files: ${tree[dir].join(', ')}\n`;
    } else {
      output += `${dir}/: ${tree[dir].join(', ')}\n`;
    }
  }

  return output;
}

function buildPersonaSection(chat: any): string {
  if (!chat.personaName || !chat.personaDescription) return '';
  return `\nPersona: ${chat.personaName}\nAdapt your responses to this communication style: ${chat.personaDescription}\n`;
}

function buildDatasourceSection(ds: any, dictionary: any[]): string {
  let section = `\nDatasource: ${ds.name} (PostgreSQL)\n`;

  if (ds.cachedSchema) {
    try {
      const schema = JSON.parse(ds.cachedSchema);
      section += 'Schema:\n';
      for (const [table, columns] of Object.entries(schema)) {
        const cols = (columns as any[]).map((c) => `${c.column_name} ${c.data_type}`).join(', ');
        section += `  ${table}: ${cols}\n`;
      }
    } catch {
      // skip malformed schema
    }
  }

  if (dictionary.length > 0) {
    section += '\nData Dictionary:\n';
    for (const entry of dictionary) {
      const aliases: string[] = entry.aliases ? JSON.parse(entry.aliases) : [];
      const aliasStr = aliases.length > 0 ? ` (also: ${aliases.join(', ')})` : '';
      section += `  - "${entry.term}"${aliasStr} → ${entry.value}\n`;
      if (entry.notes) section += `    Note: ${entry.notes}\n`;
    }
  }

  section += '\nWhen users ask data questions, write a SQL SELECT query in a sql code block. The user will run it against this database.\n';
  return section;
}

function buildSystemPrompt(chat: any, fileTreeContext: string, isFirstMessage: boolean, datasourceSection = ''): string {
  const repoName = chat.repo.name;
  // Only include repository context on FIRST message to save tokens
  const aiContext = (chat.includeContext && isFirstMessage && chat.repo.aiContext) ? chat.repo.aiContext : '';
  const personaSection = buildPersonaSection(chat);

  if (chat.type === 'SNAPSHOT') {
    return `You are an AI assistant helping to analyze the ${repoName} repository.

Current context:
- Repository: ${repoName}
- Branch: ${chat.branch}
- Commit: ${chat.commitSha}
${chat.includeContext ? '- Repository context: ENABLED (loaded at chat start)' : '- Repository context: DISABLED (basic mode)'}

You can help users understand the code, answer questions about implementation, and provide insights.
The repository is read-only and you're working with a specific snapshot at commit ${chat.commitSha}.
${personaSection}${aiContext ? '\n' + aiContext + '\n' : ''}${fileTreeContext}${datasourceSection}
When referencing files, use their full paths as plain text without any special formatting (e.g., mocktail-api/go.sum) - do NOT use markdown link syntax or backticks. Just write the path normally and it will be made clickable automatically.
When drawing ASCII diagrams, charts, or trees, always wrap them in a fenced code block (\`\`\`).`;
  } else if (chat.type === 'COMPARE') {
    return `You are an AI assistant helping to compare two branches in the ${repoName} repository.

Current context:
- Repository: ${repoName}
- Left branch: ${chat.leftBranch} (${chat.leftCommitSha})
- Right branch: ${chat.rightBranch} (${chat.rightCommitSha})
${chat.includeContext ? '- Repository context: ENABLED (loaded at chat start)' : '- Repository context: DISABLED (basic mode)'}

You can help users understand the differences between these branches, explain changes, and provide insights.
When referencing code or changes, be clear about which branch you're referring to.
${personaSection}${aiContext ? '\n' + aiContext + '\n' : ''}${fileTreeContext}${datasourceSection}
When referencing files, use their full paths as plain text without any special formatting (e.g., mocktail-api/go.sum) - do NOT use markdown link syntax or backticks. Just write the path normally and it will be made clickable automatically.
When drawing ASCII diagrams, charts, or trees, always wrap them in a fenced code block (\`\`\`).`;
  }

  return `You are an AI assistant helping to analyze the ${repoName} repository.
${chat.includeContext ? '- Repository context: ENABLED (loaded at chat start)' : '- Repository context: DISABLED'}
${personaSection}${aiContext ? '\n' + aiContext + '\n' : ''}${fileTreeContext}${datasourceSection}`;
}
