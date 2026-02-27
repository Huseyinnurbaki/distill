'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { GitBranch, Plus, RefreshCw, LogOut, FileText, Users, Globe, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Repo {
  id: string;
  name: string;
  url: string;
  defaultBranch: string;
  lastFetchedAt: string | null;
  contextUpdatedAt: string | null;
  contextFileCommits: string | null;
  pullIntervalMinutes: number;
  accessType: string;
  isGlobal: boolean;
  userId: string;
}

export default function ReposPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [contextContent, setContextContent] = useState<string | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    accessType: 'public',
    token: '',
    isGlobal: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [pullingRepos, setPullingRepos] = useState<Set<string>>(new Set());

  const toggleRepoGlobal = async (repoId: string, currentValue: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/repos/${repoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isGlobal: !currentValue }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success(!currentValue ? 'Repo is now global' : 'Repo is now private');
      fetchRepos();
    } catch (error) {
      toast.error('Failed to update repo');
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchRepos();
    }
  }, [user]);

  const fetchRepos = async () => {
    try {
      const res = await fetch('/api/repos');
      const data = await res.json();
      setRepos(data.repos || []);
    } catch (error) {
      toast.error('Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const fetchRepoContext = async (repoId: string) => {
    setLoadingContext(true);
    try {
      const res = await fetch(`/api/repos/${repoId}`);
      const data = await res.json();
      setContextContent(data.repo?.aiContext || null);
    } catch (error) {
      toast.error('Failed to fetch context');
    } finally {
      setLoadingContext(false);
    }
  };

  const openContextModal = (repo: Repo) => {
    setSelectedRepo(repo);
    setContextModalOpen(true);
    if (repo.contextUpdatedAt) {
      fetchRepoContext(repo.id);
    }
  };

  const handlePullRepo = async (repoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPullingRepos(prev => new Set(prev).add(repoId));

    try {
      const res = await fetch(`/api/repos/${repoId}/pull`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to pull');
      toast.success('Repository updated');
      fetchRepos();
    } catch (error) {
      toast.error('Failed to pull repository');
    } finally {
      setPullingRepos(prev => {
        const next = new Set(prev);
        next.delete(repoId);
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add repository');
      }

      toast.success('Repository added successfully');
      setDialogOpen(false);
      setFormData({
        name: '',
        url: '',
        accessType: 'public',
        token: '',
        isGlobal: false,
      });
      fetchRepos();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <GitBranch className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Distill</h1>
          </div>
          <div className="flex items-center gap-3">
            {user?.isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={() => router.push('/admin/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push('/admin/users')}>
                  <Users className="w-4 h-4 mr-2" />
                  Manage Users
                </Button>
              </>
            )}
            <span className="text-sm text-slate-600">
              {user?.username}
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Repositories</h2>
            <p className="text-slate-600 mt-1">
              Manage and chat with your Git repositories
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Repository
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Repository</DialogTitle>
                <DialogDescription>
                  Connect a Git repository (HTTPS only, read-only)
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Repository Name</Label>
                  <Input
                    id="name"
                    placeholder="my-awesome-repo"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">Repository URL</Label>
                  <Input
                    id="url"
                    placeholder="https://github.com/user/repo.git"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accessType">Access Type</Label>
                  <Select
                    value={formData.accessType}
                    onValueChange={(value) => setFormData({ ...formData, accessType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private (requires token)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.accessType === 'private' && (
                  <div className="space-y-2">
                    <Label htmlFor="token">Access Token</Label>
                    <Input
                      id="token"
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxx"
                      value={formData.token}
                      onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <Label htmlFor="isGlobal" className="font-medium cursor-pointer">
                      🌍 Global Repository
                    </Label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Make this repository available to all users
                    </p>
                  </div>
                  <Switch
                    id="isGlobal"
                    checked={formData.isGlobal}
                    onCheckedChange={(checked) => setFormData({ ...formData, isGlobal: checked })}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add Repository'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {repos.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GitBranch className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                No repositories yet
              </h3>
              <p className="text-slate-500 text-center mb-6">
                Add your first repository to start chatting with your code
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Repository
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {repos.map((repo) => (
              <Card
                key={repo.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <CardTitle className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <GitBranch className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <span className="truncate">{repo.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Show globe toggle - only clickable for repos the user owns */}
                      {repo.userId === user?.id ? (
                        <button
                          onClick={(e) => toggleRepoGlobal(repo.id, repo.isGlobal, e)}
                          className={cn(
                            "p-1.5 hover:bg-slate-100 rounded transition-colors flex-shrink-0",
                            repo.isGlobal ? "text-green-600 bg-green-50" : "text-slate-400"
                          )}
                          title={repo.isGlobal ? "Global - Click to make private" : "Private - Click to make global"}
                        >
                          <Globe className="w-4 h-4" />
                        </button>
                      ) : repo.isGlobal ? (
                        <div className="px-2 py-1 bg-green-50 rounded" title="Global repository">
                          <Globe className="w-4 h-4 text-green-600" />
                        </div>
                      ) : null}
                      <button
                        onClick={(e) => handlePullRepo(repo.id, e)}
                        disabled={pullingRepos.has(repo.id)}
                        className="p-1.5 hover:bg-slate-100 rounded transition-colors flex-shrink-0"
                        title="Pull latest changes"
                      >
                        <RefreshCw className={cn(
                          "w-4 h-4 text-slate-500",
                          pullingRepos.has(repo.id) && "animate-spin"
                        )} />
                      </button>
                    </div>
                  </CardTitle>
                  <CardDescription className="truncate">
                    {repo.url}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Default branch:</span>
                      <span className="font-medium">{repo.defaultBranch}</span>
                    </div>
                    {repo.lastFetchedAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Last fetched:</span>
                        <span className="text-xs text-slate-500">
                          {format(new Date(repo.lastFetchedAt), 'MMM d, HH:mm')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Context:</span>
                      {repo.contextUpdatedAt ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openContextModal(repo);
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {format(new Date(repo.contextUpdatedAt), 'MMM d, HH:mm')}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => router.push(`/repos/${repo.id}`)}
                      >
                        Chat
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => router.push(`/repos/${repo.id}/docs`)}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Docs
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Context Details Modal */}
        <Dialog open={contextModalOpen} onOpenChange={setContextModalOpen}>
          <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Repository Context</DialogTitle>
              <DialogDescription>
                {selectedRepo?.name} - What the AI knows about this repository
              </DialogDescription>
            </DialogHeader>
            {selectedRepo && (
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Last Updated</h4>
                    <p className="text-sm text-slate-600">
                      {selectedRepo.contextUpdatedAt
                        ? format(new Date(selectedRepo.contextUpdatedAt), 'MMMM d, yyyy at HH:mm:ss')
                        : 'Never'}
                    </p>
                  </div>

                  {selectedRepo.contextFileCommits && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Files Included</h4>
                      <div className="bg-slate-50 rounded-lg p-2 space-y-1">
                        {Object.entries(JSON.parse(selectedRepo.contextFileCommits)).map(
                          ([path, commit]) => (
                            <div
                              key={path}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="font-mono text-slate-700">{path}</span>
                              <span className="text-xs text-slate-500 font-mono">
                                {String(commit).substring(0, 7)}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {selectedRepo.contextUpdatedAt ? (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Context Content</h4>
                    {loadingContext ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : contextContent ? (
                      <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
                        <pre className="text-xs text-slate-100 whitespace-pre-wrap font-mono">
                          {contextContent}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">No content available</p>
                    )}
                    <p className="text-xs text-slate-500">
                      This is the exact context that gets included in every AI conversation
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p className="text-sm">No context built yet</p>
                    <p className="text-xs mt-2">
                      Add a .distill.yaml file to your repo and click Pull
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
