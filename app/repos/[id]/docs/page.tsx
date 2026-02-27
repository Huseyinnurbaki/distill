'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { MarkdownMessage } from '@/components/markdown-message';
import { cn } from '@/lib/utils';

interface RepoFile {
  path: string;
  type: string;
}

export default function RepoDocsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [repo, setRepo] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [repoMarkdownFiles, setRepoMarkdownFiles] = useState<RepoFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRepo();
      fetchBranches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  useEffect(() => {
    if (selectedBranch) {
      fetchDocs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  useEffect(() => {
    // Auto-select first available branch (sorted, so main/master comes first)
    if (branches.length > 0 && !selectedBranch) {
      console.log('Auto-selecting branch:', branches[0].branch);
      setSelectedBranch(branches[0].branch);
    }
  }, [branches, selectedBranch]);

  const fetchRepo = useCallback(async () => {
    try {
      const res = await fetch(`/api/repos/${id}`);
      const data = await res.json();
      console.log('Repo data:', data.repo);
      setRepo(data.repo);
    } catch (error) {
      console.error('Failed to fetch repository:', error);
      toast.error('Failed to fetch repository');
    }
  }, [id]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch(`/api/repos/${id}/branches`);
      const data = await res.json();
      console.log('Branches:', data.branches);
      setBranches(data.branches || []);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
      toast.error('Failed to fetch branches');
    }
  }, [id]);

  const fetchDocs = useCallback(async () => {
    if (!selectedBranch) return;
    try {
      console.log('Fetching docs for branch:', selectedBranch);
      const res = await fetch(`/api/repos/${id}/docs?branch=${selectedBranch}`);
      const data = await res.json();
      console.log('Docs response:', data);

      if (data.error) {
        toast.error(`Error: ${data.error}`);
        setRepoMarkdownFiles([]);
      } else {
        setRepoMarkdownFiles(data.files || []);
        console.log('Found markdown files:', data.files?.length || 0);
      }
    } catch (error: any) {
      console.error('Failed to fetch docs:', error);
      toast.error(`Failed to fetch docs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, id]);

  const viewRepoFile = useCallback(async (filePath: string) => {
    if (!selectedBranch) return;
    setLoadingContent(true);
    try {
      const res = await fetch(
        `/api/repos/${id}/files/${encodeURIComponent(filePath)}?branch=${selectedBranch}`
      );
      const data = await res.json();
      setSelectedFile({ path: filePath, content: data.content });
    } catch (error) {
      toast.error('Failed to load file');
    } finally {
      setLoadingContent(false);
    }
  }, [selectedBranch, id]);

  // Auto-select first file when files are loaded
  useEffect(() => {
    if (repoMarkdownFiles.length > 0 && !selectedFile) {
      viewRepoFile(repoMarkdownFiles[0].path);
    }
  }, [repoMarkdownFiles, selectedFile, viewRepoFile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <div className="border-b bg-white shadow-sm flex-shrink-0">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push('/repos')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{repo?.name} - Docs</h1>
                  <p className="text-xs text-slate-500">{repo?.url}</p>
                </div>
              </div>
            </div>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.branch} value={b.branch}>
                    {b.branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden h-full">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {!selectedBranch ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <GitBranch className="w-16 h-16 text-slate-300 mb-4 mx-auto" />
                <p className="text-slate-500">Select a branch to view markdown files</p>
              </div>
            </div>
          ) : repoMarkdownFiles.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-slate-300 mb-4 mx-auto" />
                <p className="text-slate-500">No markdown files found in repository</p>
              </div>
            </div>
          ) : loadingContent ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : selectedFile ? (
            <>
              <div className="border-b px-6 py-4 bg-slate-50 flex-shrink-0">
                <h2 className="text-lg font-semibold text-slate-900">{selectedFile.path}</h2>
                <p className="text-sm text-slate-500 mt-1">{selectedBranch}</p>
              </div>
              <div className="flex-1 overflow-y-auto px-8 py-8 bg-white">
                <div className="max-w-4xl mx-auto">
                  <MarkdownMessage content={selectedFile.content} />
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-slate-300 mb-4 mx-auto" />
                <p className="text-slate-500">Select a file to view</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - File List */}
        <div className="w-80 border-l bg-slate-50 flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-white flex-shrink-0">
            <h3 className="font-semibold text-slate-900">Documentation Files</h3>
            <p className="text-xs text-slate-500 mt-1">{repoMarkdownFiles.length} files</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {repoMarkdownFiles.map((file) => (
              <button
                key={file.path}
                onClick={() => viewRepoFile(file.path)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-1',
                  selectedFile?.path === file.path
                    ? 'bg-blue-100 text-blue-900 font-medium'
                    : 'hover:bg-white text-slate-700'
                )}
              >
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 break-words">{file.path}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
