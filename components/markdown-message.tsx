'use client';

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { SqlCodeBlock, type QueryResult } from './sql-code-block';

interface MarkdownMessageProps {
  content: string;
  className?: string;
  onFilePathClick?: (path: string) => void;
  activeDatasourceId?: string | null;
  canExecute?: boolean;
  onQueryResult?: (result: QueryResult) => void;
}

// Box-drawing and arrow characters used in ASCII diagrams
const ASCII_DIAGRAM_RE = /[┌┐└┘├┤┬┴┼─│╌╍╎╏┄┅┆┇╔╗╚╝╠╣╦╩╬═║▼▲◀▶→←↑↓]/;

function wrapAsciDiagrams(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inDiagram = false;
  let inCodeBlock = false;

  for (const line of lines) {
    // Track whether we're inside a fenced code block already
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (inDiagram && !inCodeBlock) {
        // closing fence was added by us — skip
      }
      result.push(line);
      inDiagram = false;
      continue;
    }

    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    if (ASCII_DIAGRAM_RE.test(line)) {
      if (!inDiagram) {
        result.push('```');
        inDiagram = true;
      }
      result.push(line);
    } else {
      if (inDiagram) {
        result.push('```');
        inDiagram = false;
      }
      result.push(line);
    }
  }

  if (inDiagram) result.push('```');
  return result.join('\n');
}

export function MarkdownMessage({ content, className = '', onFilePathClick, activeDatasourceId, canExecute = false, onQueryResult }: MarkdownMessageProps) {
  const processedContent = wrapAsciDiagrams(content);

  const detectAndRenderFilePaths = (text: string) => {
    const pathPattern = /([a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-\.]+){1,})/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = pathPattern.exec(text)) !== null) {
      // Add text before the path
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const path = match[1];
      // Create a clickable element for the path
      parts.push(
        <button
          key={`${match.index}-${path}`}
          onClick={(e) => {
            e.preventDefault();
            if (onFilePathClick) {
              onFilePathClick(path);
            }
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200 rounded border border-blue-200 font-mono text-xs cursor-pointer transition-colors"
        >
          📄 {path}
        </button>
      );

      lastIndex = match.index + path.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : text;
  };

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Custom text renderer to detect file paths
          text({ value, ...props }: any) {
            return detectAndRenderFilePaths(value);
          },
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';

          if (!inline && language === 'sql' && activeDatasourceId) {
            return (
              <SqlCodeBlock
                sql={String(children).replace(/\n$/, '')}
                datasourceId={activeDatasourceId}
                canExecute={canExecute}
                onResult={onQueryResult}
              />
            );
          }

          if (!inline && language) {
            return (
              <SyntaxHighlighter
                style={oneDark}
                language={language}
                PreTag="div"
                className="rounded-md my-4 text-sm"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            );
          }

          if (!inline && !language) {
            // Fenced code block without language — e.g. ASCII diagrams
            return (
              <pre className="overflow-x-auto my-4 bg-slate-50 border border-slate-200 rounded-md p-4">
                <code className="text-sm font-mono text-slate-800 whitespace-pre">
                  {children}
                </code>
              </pre>
            );
          }

          return (
            <code
              className="bg-slate-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },
        pre({ children }: any) {
          return <div className="overflow-x-auto">{children}</div>;
        },
        p({ children }: any) {
          return <div className="mb-4 leading-7 text-slate-700">{children}</div>;
        },
        ul({ children }: any) {
          return <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>;
        },
        ol({ children }: any) {
          return <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>;
        },
        li({ children }: any) {
          return <li className="leading-7 text-slate-700">{children}</li>;
        },
        h1({ children }: any) {
          return (
            <h1 className="text-3xl font-bold mb-4 mt-6 pb-2 border-b border-slate-200 text-slate-900">
              {children}
            </h1>
          );
        },
        h2({ children }: any) {
          return (
            <h2 className="text-2xl font-bold mb-3 mt-6 pb-2 border-b border-slate-200 text-slate-900">
              {children}
            </h2>
          );
        },
        h3({ children }: any) {
          return <h3 className="text-xl font-bold mb-3 mt-4 text-slate-900">{children}</h3>;
        },
        h4({ children }: any) {
          return <h4 className="text-lg font-bold mb-2 mt-4 text-slate-900">{children}</h4>;
        },
        h5({ children }: any) {
          return <h5 className="text-base font-bold mb-2 mt-3 text-slate-900">{children}</h5>;
        },
        h6({ children }: any) {
          return <h6 className="text-sm font-bold mb-2 mt-3 text-slate-700">{children}</h6>;
        },
        blockquote({ children }: any) {
          return (
            <blockquote className="border-l-4 border-slate-300 pl-4 py-1 my-4 text-slate-600 bg-slate-50">
              {children}
            </blockquote>
          );
        },
        hr({ }: any) {
          return <hr className="my-6 border-t border-slate-300" />;
        },
        img({ src, alt, node }: any) {
          // Check if this is a badge/shield image
          const isBadge = src?.includes('shields.io') ||
                         src?.includes('img.shields.io') ||
                         src?.includes('badge') ||
                         src?.includes('/badge/');

          // eslint-disable-next-line @next/next/no-img-element
          return (
            <img
              src={src}
              alt={alt}
              className={isBadge
                ? "inline-block h-5 mr-1 align-middle"
                : "max-w-full h-auto rounded-lg my-4 border border-slate-200 block"
              }
            />
          );
        },
        a({ children, href, ...props }: any) {
          // Special styling for file paths
          if (href?.startsWith('file://')) {
            return (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const filePath = href.replace('file://', '');
                  console.log('File link clicked in markdown:', filePath);
                  if (onFilePathClick) {
                    onFilePathClick(filePath);
                  }
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200 rounded border border-blue-200 font-mono text-sm no-underline cursor-pointer transition-colors"
                {...props}
              >
                {children}
              </a>
            );
          }

          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
              {...props}
            >
              {children}
            </a>
          );
        },
        table({ children }: any) {
          return (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-slate-300 text-sm">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }: any) {
          return <thead className="bg-slate-100">{children}</thead>;
        },
        tbody({ children }: any) {
          return <tbody className="bg-white">{children}</tbody>;
        },
        tr({ children }: any) {
          return <tr className="border-b border-slate-200 hover:bg-slate-50">{children}</tr>;
        },
        th({ children }: any) {
          return (
            <th className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-900">
              {children}
            </th>
          );
        },
        td({ children }: any) {
          return <td className="border border-slate-300 px-4 py-2 text-slate-700">{children}</td>;
        },
        strong({ children }: any) {
          return <strong className="font-semibold text-slate-900">{children}</strong>;
        },
        em({ children }: any) {
          return <em className="italic text-slate-700">{children}</em>;
        },
        del({ children }: any) {
          return <del className="line-through text-slate-500">{children}</del>;
        },
        details({ children, open }: any) {
          return (
            <details className="my-4 border border-slate-300 rounded-md bg-slate-50 overflow-hidden" open={open}>
              {children}
            </details>
          );
        },
        summary({ children }: any) {
          return (
            <summary className="px-4 py-2 cursor-pointer font-medium text-slate-900 hover:bg-slate-100 list-none [&::-webkit-details-marker]:hidden">
              ▶ {children}
            </summary>
          );
        },
      }}
    >
      {processedContent}
    </ReactMarkdown>
    </div>
  );
}
