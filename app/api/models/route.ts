import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '@/lib/session';
import { modelCache, CACHE_TTL_MS, type ModelOption } from '@/lib/model-cache';

// Words that indicate a model is NOT a chat model
const OPENAI_EXCLUDE = [
  'instruct', 'embed', 'whisper', 'dall-e', 'tts', 'realtime',
  'audio', 'transcribe', 'search', 'moderation', 'babbage',
  'davinci', 'ada', 'curie', 'text-', 'omni-mini', 'codex', 'image',
];

function isOpenAIChatModel(id: string): boolean {
  const lower = id.toLowerCase();
  if (OPENAI_EXCLUDE.some((word) => lower.includes(word))) return false;
  return lower.startsWith('gpt-') || /^o\d/.test(lower);
}

function openAIDisplayName(id: string): string {
  const names: Record<string, string> = {
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4': 'GPT-4',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'o1': 'o1',
    'o1-mini': 'o1 Mini',
    'o1-preview': 'o1 Preview',
    'o3': 'o3',
    'o3-mini': 'o3 Mini',
    'o4-mini': 'o4 Mini',
  };
  return names[id] ?? id;
}

function anthropicDisplayName(id: string): string {
  const names: Record<string, string> = {
    'claude-opus-4-5': 'Claude Opus 4.5',
    'claude-sonnet-4-5': 'Claude Sonnet 4.5',
    'claude-haiku-4-5': 'Claude Haiku 4.5',
    'claude-3-5-sonnet-latest': 'Claude 3.5 Sonnet',
    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'claude-3-5-haiku-latest': 'Claude 3.5 Haiku',
    'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
    'claude-3-opus-latest': 'Claude 3 Opus',
    'claude-3-opus-20240229': 'Claude 3 Opus',
    'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
    'claude-3-haiku-20240307': 'Claude 3 Haiku',
  };
  return names[id] ?? id;
}

async function fetchOpenAIModels(): Promise<ModelOption[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  const response = await openai.models.list();
  return response.data
    .filter((m) => isOpenAIChatModel(m.id))
    .sort((a, b) => b.created - a.created)
    .map((m) => ({ id: m.id, name: openAIDisplayName(m.id) }));
}

async function fetchAnthropicModels(): Promise<ModelOption[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  const response = await anthropic.models.list();
  return response.data
    .map((m: { id: string }) => ({ id: m.id, name: anthropicDisplayName(m.id) }));
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const provider = request.nextUrl.searchParams.get('provider');
    if (provider !== 'openai' && provider !== 'anthropic') {
      return NextResponse.json({ error: 'provider must be openai or anthropic' }, { status: 400 });
    }

    const cached = modelCache[provider];
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json({ models: cached.models });
    }

    const models =
      provider === 'openai' ? await fetchOpenAIModels() : await fetchAnthropicModels();

    modelCache[provider] = { models, fetchedAt: Date.now() };

    return NextResponse.json({ models });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error(`Failed to fetch ${request.nextUrl.searchParams.get('provider')} models:`, error);
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}
