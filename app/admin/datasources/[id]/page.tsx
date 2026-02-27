'use client';

import { use, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, RefreshCw, Database } from 'lucide-react';
import { toast } from 'sonner';

interface DatasourceDetail {
  id: string;
  name: string;
  type: string;
  schemaUpdatedAt: string | null;
}

interface Assignment {
  id: string;
  branch: string;
  repo: { id: string; name: string };
}

interface AccessEntry {
  id: string;
  user: { id: string; username: string; email: string };
}

interface DictionaryEntry {
  id: string;
  term: string;
  aliases: string | null;
  value: string;
  notes: string | null;
}

interface Repo {
  id: string;
  name: string;
}

interface User {
  id: string;
  username: string;
  email: string;
}

const EMPTY_DICT: Omit<DictionaryEntry, 'id'> = { term: '', aliases: null, value: '', notes: null };

export default function DatasourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [datasource, setDatasource] = useState<DatasourceDetail | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [introspecting, setIntrospecting] = useState(false);

  // Assignment modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignRepoId, setAssignRepoId] = useState('');
  const [assignBranch, setAssignBranch] = useState('');
  const [assignBranchesLoading, setAssignBranchesLoading] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);

  // Access modal state
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [savingAccess, setSavingAccess] = useState(false);

  // Dictionary modal state
  const [dictModalOpen, setDictModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null);
  const [dictForm, setDictForm] = useState({ term: '', aliasesText: '', value: '', notes: '' });
  const [savingDict, setSavingDict] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) {
      router.push('/repos');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.isAdmin) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dsRes, assignRes, accessRes, dictRes, reposRes, usersRes] = await Promise.all([
        fetch(`/api/admin/datasources/${id}`),
        fetch(`/api/admin/datasources/${id}/assignments`),
        fetch(`/api/admin/datasources/${id}/access`),
        fetch(`/api/admin/datasources/${id}/dictionary`),
        fetch('/api/repos'),
        fetch('/api/admin/users'),
      ]);
      const [dsData, assignData, accessData, dictData, reposData, usersData] = await Promise.all([
        dsRes.json(),
        assignRes.json(),
        accessRes.json(),
        dictRes.json(),
        reposRes.json(),
        usersRes.json(),
      ]);
      setDatasource(dsData.datasource ?? null);
      setAssignments(assignData.assignments ?? []);
      setAccessList(accessData.accessList ?? []);
      setDictionary(dictData.entries ?? []);
      setRepos(reposData.repos ?? []);
      setUsers(usersData.users ?? []);
    } catch {
      toast.error('Failed to load datasource data');
    } finally {
      setLoading(false);
    }
  };

  const handleIntrospect = async () => {
    setIntrospecting(true);
    try {
      const res = await fetch(`/api/admin/datasources/${id}/introspect`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Schema introspected');
      loadAll();
    } catch (e: any) {
      toast.error(e.message || 'Introspection failed');
    } finally {
      setIntrospecting(false);
    }
  };

  const loadBranches = async (repoId: string) => {
    if (!repoId) return;
    setAssignBranchesLoading(true);
    try {
      const res = await fetch(`/api/repos/${repoId}/branches`);
      const data = await res.json();
      setBranches((data.branches ?? []).map((b: any) => b.branch));
    } catch {
      setBranches([]);
    } finally {
      setAssignBranchesLoading(false);
    }
  };

  const openAssignModal = () => {
    setAssignRepoId('');
    setAssignBranch('');
    setBranches([]);
    setAssignModalOpen(true);
  };

  const handleSaveAssignment = async () => {
    if (!assignRepoId || !assignBranch) {
      toast.error('Select a repo and branch');
      return;
    }
    setSavingAssign(true);
    try {
      const res = await fetch(`/api/admin/datasources/${id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId: assignRepoId, branch: assignBranch }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success('Assignment added');
      setAssignModalOpen(false);
      loadAll();
    } catch (e: any) {
      toast.error(e.message || 'Failed to add assignment');
    } finally {
      setSavingAssign(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Remove this assignment?')) return;
    try {
      await fetch(`/api/admin/datasources/${id}/assignments/${id}`, { method: 'DELETE' });
      toast.success('Assignment removed');
      loadAll();
    } catch {
      toast.error('Failed to remove assignment');
    }
  };

  const openAccessModal = () => {
    setSelectedUserIds(new Set());
    setAccessModalOpen(true);
  };

  const toggleUserId = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSaveAccess = async () => {
    if (selectedUserIds.size === 0) { toast.error('Select at least one user'); return; }
    setSavingAccess(true);
    try {
      await Promise.all(
        Array.from(selectedUserIds).map((userId) =>
          fetch(`/api/admin/datasources/${id}/access`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          })
        )
      );
      toast.success(`Access granted to ${selectedUserIds.size} user${selectedUserIds.size > 1 ? 's' : ''}`);
      setAccessModalOpen(false);
      loadAll();
    } catch {
      toast.error('Failed to add access');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleDeleteAccess = async (id: string) => {
    if (!confirm('Remove this user\'s access?')) return;
    try {
      await fetch(`/api/admin/datasources/${id}/access/${id}`, { method: 'DELETE' });
      toast.success('Access removed');
      loadAll();
    } catch {
      toast.error('Failed to remove access');
    }
  };

  const openNewDictEntry = () => {
    setEditingEntry(null);
    setDictForm({ term: '', aliasesText: '', value: '', notes: '' });
    setDictModalOpen(true);
  };

  const openEditDictEntry = (entry: DictionaryEntry) => {
    setEditingEntry(entry);
    const parsed: string[] = entry.aliases ? JSON.parse(entry.aliases) : [];
    setDictForm({ term: entry.term, aliasesText: parsed.join(', '), value: entry.value, notes: entry.notes ?? '' });
    setDictModalOpen(true);
  };

  const handleSaveDict = async () => {
    if (!dictForm.term || !dictForm.value) { toast.error('Term and value are required'); return; }
    setSavingDict(true);
    const aliases = dictForm.aliasesText.trim()
      ? dictForm.aliasesText.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const payload = { term: dictForm.term, aliases, value: dictForm.value, notes: dictForm.notes || null };
    try {
      const url = editingEntry
        ? `/api/admin/datasources/${id}/dictionary/${editingEntry.id}`
        : `/api/admin/datasources/${id}/dictionary`;
      const method = editingEntry ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(editingEntry ? 'Entry updated' : 'Entry created');
      setDictModalOpen(false);
      loadAll();
    } catch {
      toast.error('Failed to save entry');
    } finally {
      setSavingDict(false);
    }
  };

  const handleDeleteDict = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await fetch(`/api/admin/datasources/${id}/dictionary/${id}`, { method: 'DELETE' });
      toast.success('Entry deleted');
      loadAll();
    } catch {
      toast.error('Failed to delete entry');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!datasource) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Datasource not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin/settings')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              <div>
                <h1 className="text-xl font-bold text-slate-900">{datasource.name}</h1>
                <p className="text-xs text-slate-500">{datasource.type}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {datasource.schemaUpdatedAt && (
              <span className="text-xs text-slate-400">
                Schema updated {new Date(datasource.schemaUpdatedAt).toLocaleString()}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleIntrospect} disabled={introspecting}>
              <RefreshCw className={`w-4 h-4 mr-2 ${introspecting ? 'animate-spin' : ''}`} />
              {introspecting ? 'Introspecting…' : 'Re-introspect Schema'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Assignments */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle>Assignments</CardTitle>
            <Button size="sm" onClick={openAssignModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Assignment
            </Button>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <p className="text-sm text-slate-500">No assignments yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-600">
                    <th className="pb-2 pr-4">Repo</th>
                    <th className="pb-2 pr-4">Branch</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{a.repo.name}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{a.branch}</td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteAssignment(a.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* User Access */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle>User Access</CardTitle>
            <Button size="sm" onClick={openAccessModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-3">Admins can always execute queries. Listed users can also run queries.</p>
            {accessList.length === 0 ? (
              <p className="text-sm text-slate-500">No users with execute access.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-600">
                    <th className="pb-2 pr-4">Username</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {accessList.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{a.user.username}</td>
                      <td className="py-2 pr-4 text-slate-500">{a.user.email}</td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteAccess(a.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Data Dictionary */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle>Data Dictionary</CardTitle>
            <Button size="sm" onClick={openNewDictEntry}>
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-3">Map business terms to database values to help the AI generate precise queries.</p>
            {dictionary.length === 0 ? (
              <p className="text-sm text-slate-500">No dictionary entries.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-600">
                    <th className="pb-2 pr-4">Term</th>
                    <th className="pb-2 pr-4">Aliases</th>
                    <th className="pb-2 pr-4">Value</th>
                    <th className="pb-2 pr-4">Notes</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {dictionary.map((e) => {
                    const aliases: string[] = e.aliases ? JSON.parse(e.aliases) : [];
                    return (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{e.term}</td>
                        <td className="py-2 pr-4 text-slate-500 text-xs">{aliases.join(', ') || '—'}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{e.value}</td>
                        <td className="py-2 pr-4 text-slate-500 text-xs">{e.notes || '—'}</td>
                        <td className="py-2 text-right flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEditDictEntry(e)}>
                            <span className="text-xs">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => handleDeleteDict(e.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assignment Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Repository</Label>
              <Select
                value={assignRepoId}
                onValueChange={(v) => {
                  setAssignRepoId(v);
                  setAssignBranch('');
                  loadBranches(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select repo" />
                </SelectTrigger>
                <SelectContent>
                  {repos.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Branch</Label>
              <Select value={assignBranch} onValueChange={setAssignBranch} disabled={!assignRepoId || assignBranchesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={assignBranchesLoading ? 'Loading…' : 'Select branch'} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAssignModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAssignment} disabled={savingAssign}>
              {savingAssign ? 'Saving…' : 'Add'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Access Modal */}
      <Dialog open={accessModalOpen} onOpenChange={setAccessModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add User Access</DialogTitle>
          </DialogHeader>
          {(() => {
            const eligible = users.filter((u) => !accessList.some((a) => a.user.id === u.id));
            return eligible.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">All users already have access.</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto py-1">
                {eligible.map((u) => {
                  const checked = selectedUserIds.has(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50 border border-transparent'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUserId(u.id)}
                        className="accent-emerald-600 w-4 h-4 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{u.username}</div>
                        <div className="text-xs text-slate-500 truncate">{u.email}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            );
          })()}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              {selectedUserIds.size > 0 ? `${selectedUserIds.size} selected` : ''}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAccessModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveAccess} disabled={savingAccess || selectedUserIds.size === 0}>
                {savingAccess ? 'Saving…' : `Add${selectedUserIds.size > 1 ? ` (${selectedUserIds.size})` : ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dictionary Entry Modal */}
      <Dialog open={dictModalOpen} onOpenChange={setDictModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Entry' : 'New Dictionary Entry'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Term</Label>
              <Input
                value={dictForm.term}
                onChange={(e) => setDictForm((f) => ({ ...f, term: e.target.value }))}
                placeholder="e.g. Tesla"
              />
            </div>
            <div className="space-y-1">
              <Label>Aliases (comma-separated)</Label>
              <Input
                value={dictForm.aliasesText}
                onChange={(e) => setDictForm((f) => ({ ...f, aliasesText: e.target.value }))}
                placeholder="e.g. Tesla Inc, TSLA"
              />
            </div>
            <div className="space-y-1">
              <Label>Value</Label>
              <Input
                value={dictForm.value}
                onChange={(e) => setDictForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="e.g. 555uuid or specific DB value"
              />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <textarea
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                value={dictForm.notes}
                onChange={(e) => setDictForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Additional context for the AI..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDictModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDict} disabled={savingDict}>
              {savingDict ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
