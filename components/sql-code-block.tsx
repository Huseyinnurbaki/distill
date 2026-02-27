'use client';

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

export interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  sql: string;
}

interface SqlCodeBlockProps {
  sql: string;
  datasourceId: string | null;
  canExecute: boolean;
  onResult?: (result: QueryResult) => void;
}

export function SqlCodeBlock({ sql, datasourceId, canExecute, onResult }: SqlCodeBlockProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);

  const handleRun = async () => {
    if (!datasourceId || !canExecute) return;
    setRunning(true);
    setError(null);
    setRowCount(null);
    try {
      const res = await fetch(`/api/datasources/${datasourceId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');
      setRowCount(data.rowCount);
      if (onResult) onResult(data as QueryResult);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="my-4 rounded-md overflow-hidden border border-slate-700">
      <SyntaxHighlighter
        style={oneDark}
        language="sql"
        PreTag="div"
        className="!my-0 !rounded-none text-sm"
        customStyle={{ margin: 0, borderRadius: 0 }}
      >
        {sql.replace(/\n$/, '')}
      </SyntaxHighlighter>
      {datasourceId && (
        <div className="bg-slate-800 px-3 py-2 flex items-center justify-between gap-3">
          {canExecute ? (
            <button
              onClick={handleRun}
              disabled={running}
              className="px-3 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded transition-colors"
            >
              {running ? 'Running…' : '▶ Run'}
            </button>
          ) : (
            <span className="text-xs text-slate-400">No execute access</span>
          )}
          {rowCount !== null && !error && (
            <span className="text-xs text-emerald-400">✓ {rowCount} row{rowCount !== 1 ? 's' : ''} returned</span>
          )}
          {error && (
            <span className="text-xs text-red-400 truncate max-w-xs" title={error}>✗ {error}</span>
          )}
        </div>
      )}
    </div>
  );
}
