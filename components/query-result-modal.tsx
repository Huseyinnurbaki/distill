'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { QueryResult } from './sql-code-block';

interface QueryResultModalProps {
  result: QueryResult | null;
  onClose: () => void;
}

const PAGE_SIZE = 50;

export function QueryResultModal({ result, onClose }: QueryResultModalProps) {
  const [tab, setTab] = useState<'table' | 'sql' | 'raw'>('table');
  const [page, setPage] = useState(0);

  if (!result) return null;

  const totalPages = Math.ceil(result.rows.length / PAGE_SIZE);
  const pageRows = result.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExportCSV = () => {
    const header = result.columns.join(',');
    const rows = result.rows.map((row) =>
      row.map((cell) => {
        const v = cell === null || cell === undefined ? '' : String(cell);
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"`
          : v;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query-result.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>Query Result — {result.rowCount} rows</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>Export CSV</Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 border-b">
          {(['table', 'sql', 'raw'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {tab === 'table' && (
            <div>
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    {result.columns.map((col) => (
                      <th key={col} className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-slate-50">
                      {row.map((cell, ci) => (
                        <td key={ci} className="border border-slate-200 px-3 py-1.5 text-slate-700 max-w-xs truncate" title={cell === null ? 'NULL' : String(cell)}>
                          {cell === null ? <span className="text-slate-400 italic">NULL</span> : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t bg-white sticky bottom-0">
                  <span className="text-xs text-slate-500">Page {page + 1} of {totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'sql' && (
            <pre className="p-4 text-sm font-mono text-slate-700 whitespace-pre-wrap">{result.sql}</pre>
          )}

          {tab === 'raw' && (
            <pre className="p-4 text-xs font-mono text-slate-700 whitespace-pre-wrap overflow-auto">
              {JSON.stringify({ columns: result.columns, rows: result.rows }, null, 2)}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
