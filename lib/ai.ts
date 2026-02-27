import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export type AIProvider = 'openai' | 'anthropic';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function callAI(
  provider: AIProvider,
  model: string,
  messages: AIMessage[],
  maxTokens = 256
): Promise<string> {
  if (provider === 'openai') {
    // o-series and gpt-5+ use max_completion_tokens; gpt-4 and earlier use max_tokens
    const useMaxCompletion = /^o\d/.test(model) || /^gpt-5/.test(model);
    const response = await openai.chat.completions.create({
      model,
      messages: messages.map((m) => ({
        role: m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      ...(useMaxCompletion ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
      stream: false,
    });
    return response.choices[0]?.message?.content ?? '';
  } else if (provider === 'anthropic') {
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemMessage?.content,
      messages: conversationMessages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    });
    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

export async function* streamAIResponse(
  provider: AIProvider,
  model: string,
  messages: AIMessage[]
): AsyncGenerator<AIStreamChunk> {
  if (provider === 'openai') {
    yield* streamOpenAI(model, messages);
  } else if (provider === 'anthropic') {
    yield* streamAnthropic(model, messages);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

async function* streamOpenAI(
  model: string,
  messages: AIMessage[]
): AsyncGenerator<AIStreamChunk> {
  const stream = await openai.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      yield { content, done: false };
    }
  }

  yield { content: '', done: true };
}

async function* streamAnthropic(
  model: string,
  messages: AIMessage[]
): AsyncGenerator<AIStreamChunk> {
  const systemMessage = messages.find((m) => m.role === 'system');
  const conversationMessages = messages.filter((m) => m.role !== 'system');

  const stream = await anthropic.messages.stream({
    model,
    max_tokens: 4096,
    system: systemMessage?.content,
    messages: conversationMessages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
  });

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      yield { content: chunk.delta.text, done: false };
    }
  }

  yield { content: '', done: true };
}

