'use client';

import { memo, type ReactNode } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Matches fenced code blocks: ```lang\n ... ```
const FENCE_RE = /```(\w*)\r?\n?([\s\S]*?)```/g;

/**
 * Renders a user-sent message. Plain text is kept as-is (white on the blue
 * bubble); fenced code blocks (e.g. ```sql … ```) are syntax-highlighted so
 * queries the user pastes read the same as the ones the assistant returns.
 */
function UserMessageContentBase({ content }: { content: string }) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  const pushText = (text: string) => {
    const trimmed = text.replace(/^\n+/, '').replace(/\n+$/, '');
    if (trimmed.length) {
      parts.push(
        <div key={key++} className="whitespace-pre-wrap">
          {trimmed}
        </div>
      );
    }
  };

  while ((match = FENCE_RE.exec(content)) !== null) {
    pushText(content.slice(lastIndex, match.index));
    const language = match[1] || 'text';
    const code = match[2].replace(/\n$/, '');
    parts.push(
      <SyntaxHighlighter
        key={key++}
        style={oneLight}
        language={language}
        PreTag="div"
        className="rounded-md text-xs border border-blue-200"
        customStyle={{ margin: 0, background: 'transparent' }}
      >
        {code}
      </SyntaxHighlighter>
    );
    lastIndex = match.index + match[0].length;
  }
  pushText(content.slice(lastIndex));

  if (parts.length === 0) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }
  return <div className="space-y-2">{parts}</div>;
}

export const UserMessageContent = memo(UserMessageContentBase);
