'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Save, Plus, Pencil, Trash2, Star, Database, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { PersonaRadarChart } from '@/components/persona-radar-chart';

interface ModelOption {
  id: string;
  name: string;
}

interface Datasource {
  id: string;
  name: string;
  type: string;
  schemaUpdatedAt: string | null;
}

interface Persona {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  technicalDepth: number;
  codeExamples: number;
  assumedKnowledge: number;
  businessContext: number;
  responseDetail: number;
}

const EMPTY_PERSONA: Omit<Persona, 'id'> = {
  name: '',
  description: '',
  isDefault: false,
  technicalDepth: 3,
  codeExamples: 3,
  assumedKnowledge: 3,
  businessContext: 3,
  responseDetail: 3,
};

const SCORE_LABELS: Record<string, string> = {
  technicalDepth: 'Technical Depth',
  codeExamples: 'Code Examples',
  assumedKnowledge: 'Assumed Knowledge',
  businessContext: 'Business Context',
  responseDetail: 'Response Detail',
};

export default function AdminSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [openAIModels, setOpenAIModels] = useState<ModelOption[]>([]);
  const [anthropicModels, setAnthropicModels] = useState<ModelOption[]>([]);
  const [defaultOpenAIModel, setDefaultOpenAIModel] = useState('');
  const [defaultAnthropicModel, setDefaultAnthropicModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaModalOpen, setPersonaModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [personaForm, setPersonaForm] = useState<Omit<Persona, 'id'>>(EMPTY_PERSONA);
  const [savingPersona, setSavingPersona] = useState(false);

  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [dsModalOpen, setDsModalOpen] = useState(false);
  const [editingDs, setEditingDs] = useState<Datasource | null>(null);
  const [dsForm, setDsForm] = useState({ name: '', connString: '' });
  const [savingDs, setSavingDs] = useState(false);
  const [testingDs, setTestingDs] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

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
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [settingsRes, openAIRes, anthropicRes, personasRes, dsRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/models?provider=openai'),
        fetch('/api/models?provider=anthropic'),
        fetch('/api/admin/personas'),
        fetch('/api/admin/datasources'),
      ]);

      const [settingsData, openAIData, anthropicData, personasData, dsData] = await Promise.all([
        settingsRes.json(),
        openAIRes.json(),
        anthropicRes.json(),
        personasRes.json(),
        dsRes.json(),
      ]);

      const oaiModels: ModelOption[] = openAIData.models ?? [];
      const antModels: ModelOption[] = anthropicData.models ?? [];

      setOpenAIModels(oaiModels);
      setAnthropicModels(antModels);
      setPersonas(personasData.personas ?? []);
      setDatasources(dsData.datasources ?? []);

      const savedOAI = settingsData.settings?.defaultOpenAIModel;
      const savedAnt = settingsData.settings?.defaultAnthropicModel;

      setDefaultOpenAIModel(
        oaiModels.find((m) => m.id === savedOAI) ? savedOAI : oaiModels[0]?.id ?? ''
      );
      setDefaultAnthropicModel(
        antModels.find((m) => m.id === savedAnt) ? savedAnt : antModels[0]?.id ?? ''
      );
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultOpenAIModel, defaultAnthropicModel }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const openNewPersonaModal = () => {
    setEditingPersona(null);
    setPersonaForm(EMPTY_PERSONA);
    setPersonaModalOpen(true);
  };

  const openEditPersonaModal = (persona: Persona) => {
    setEditingPersona(persona);
    setPersonaForm({
      name: persona.name,
      description: persona.description,
      isDefault: persona.isDefault,
      technicalDepth: persona.technicalDepth,
      codeExamples: persona.codeExamples,
      assumedKnowledge: persona.assumedKnowledge,
      businessContext: persona.businessContext,
      responseDetail: persona.responseDetail,
    });
    setPersonaModalOpen(true);
  };

  const handleSavePersona = async () => {
    if (!personaForm.name || !personaForm.description) {
      toast.error('Name and description are required');
      return;
    }
    setSavingPersona(true);
    try {
      const url = editingPersona
        ? `/api/admin/personas/${editingPersona.id}`
        : '/api/admin/personas';
      const method = editingPersona ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personaForm),
      });

      if (!res.ok) throw new Error('Failed to save persona');
      toast.success(editingPersona ? 'Persona updated' : 'Persona created');
      setPersonaModalOpen(false);
      loadAll();
    } catch {
      toast.error('Failed to save persona');
    } finally {
      setSavingPersona(false);
    }
  };

  const handleDeletePersona = async (id: string) => {
    if (!confirm('Delete this persona?')) return;
    try {
      const res = await fetch(`/api/admin/personas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Persona deleted');
      loadAll();
    } catch {
      toast.error('Failed to delete persona');
    }
  };

  const handleSetDefault = async (persona: Persona) => {
    try {
      await fetch(`/api/admin/personas/${persona.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      loadAll();
    } catch {
      toast.error('Failed to update default');
    }
  };

  const openNewDsModal = () => {
    setEditingDs(null);
    setDsForm({ name: '', connString: '' });
    setTestResult(null);
    setDsModalOpen(true);
  };

  const openEditDsModal = (ds: Datasource) => {
    setEditingDs(ds);
    setDsForm({ name: ds.name, connString: '' });
    setTestResult(null);
    setDsModalOpen(true);
  };

  const handleSaveDs = async () => {
    if (!dsForm.name) { toast.error('Name is required'); return; }
    if (!editingDs && !dsForm.connString) { toast.error('Connection string is required'); return; }
    setSavingDs(true);
    try {
      const url = editingDs ? `/api/admin/datasources/${editingDs.id}` : '/api/admin/datasources';
      const method = editingDs ? 'PATCH' : 'POST';
      const body = editingDs
        ? { name: dsForm.name, ...(dsForm.connString ? { connString: dsForm.connString } : {}) }
        : { name: dsForm.name, connString: dsForm.connString };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(editingDs ? 'Datasource updated' : 'Datasource created');
      setDsModalOpen(false);
      loadAll();
    } catch {
      toast.error('Failed to save datasource');
    } finally {
      setSavingDs(false);
    }
  };

  const handleDeleteDs = async (id: string) => {
    if (!confirm('Delete this datasource?')) return;
    try {
      const res = await fetch(`/api/admin/datasources/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Datasource deleted');
      loadAll();
    } catch {
      toast.error('Failed to delete datasource');
    }
  };

  const handleTestDs = async () => {
    if (!editingDs) return;
    setTestingDs(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/datasources/${editingDs.id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: 'Request failed' });
    } finally {
      setTestingDs(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/repos')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Repos
            </Button>
            <h1 className="text-xl font-bold text-slate-900">Settings</h1>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Default AI Models */}
        <Card>
          <CardHeader>
            <CardTitle>Default AI Models</CardTitle>
            <CardDescription>
              These models are pre-selected when users open a new chat. Users can still switch models mid-conversation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>OpenAI Default Model</Label>
              <Select value={defaultOpenAIModel} onValueChange={setDefaultOpenAIModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {openAIModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Anthropic Default Model</Label>
              <Select value={defaultAnthropicModel} onValueChange={setDefaultAnthropicModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {anthropicModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Personas */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Personas</CardTitle>
              <CardDescription className="mt-1">
                Personas shape how the AI communicates. Users select a persona when starting or during a chat.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openNewPersonaModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Persona
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {personas.map((persona) => (
                <div
                  key={persona.id}
                  className={`border rounded-lg p-4 flex flex-col gap-3 bg-white ${persona.isDefault ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{persona.name}</span>
                        {persona.isDefault && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Default</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{persona.description}</p>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <PersonaRadarChart persona={persona} size={210} />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {!persona.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleSetDefault(persona)}
                      >
                        <Star className="w-3 h-3 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => openEditPersonaModal(persona)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:border-red-300"
                      onClick={() => handleDeletePersona(persona.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Datasources */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Datasources</CardTitle>
              <CardDescription className="mt-1">
                Connect live databases so the AI can understand actual data alongside the code.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openNewDsModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Datasource
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {datasources.length === 0 && (
                <p className="text-sm text-slate-500">No datasources configured.</p>
              )}
              {datasources.map((ds) => (
                <div key={ds.id} className="border rounded-lg p-4 flex items-center justify-between bg-white border-slate-200">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-slate-900">{ds.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{ds.type}</span>
                        {ds.schemaUpdatedAt && (
                          <span className="text-xs text-slate-400">
                            Schema: {new Date(ds.schemaUpdatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => router.push(`/admin/datasources/${ds.id}`)}>
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Manage
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditDsModal(ds)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:border-red-300"
                      onClick={() => handleDeleteDs(ds.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Datasource modal */}
      <Dialog open={dsModalOpen} onOpenChange={setDsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDs ? 'Edit Datasource' : 'New Datasource'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={dsForm.name}
                onChange={(e) => setDsForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Production DB"
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Input value="postgres" disabled className="bg-slate-50 text-slate-500" />
            </div>
            <div className="space-y-1">
              <Label>{editingDs ? 'New Connection String (leave blank to keep current)' : 'Connection String'}</Label>
              <Input
                type="password"
                value={dsForm.connString}
                onChange={(e) => setDsForm((f) => ({ ...f, connString: e.target.value }))}
                placeholder="postgresql://user:pass@host:5432/db"
              />
            </div>
            {editingDs && (
              <div>
                <Button variant="outline" size="sm" onClick={handleTestDs} disabled={testingDs}>
                  {testingDs ? 'Testing…' : 'Test Connection'}
                </Button>
                {testResult && (
                  <p className={`mt-2 text-sm ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {testResult.ok ? '✓ Connection successful' : `✗ ${testResult.error}`}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDs} disabled={savingDs}>
              {savingDs ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Persona modal */}
      <Dialog open={personaModalOpen} onOpenChange={setPersonaModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPersona ? 'Edit Persona' : 'New Persona'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={personaForm.name}
                  onChange={(e) => setPersonaForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. The Deep Dive"
                />
              </div>

              <div className="space-y-1">
                <Label>Description</Label>
                <textarea
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={personaForm.description}
                  onChange={(e) => setPersonaForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Instructions for the AI on how to adapt its responses..."
                />
              </div>

              <div className="space-y-3">
                {Object.keys(SCORE_LABELS).map((key) => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between">
                      <Label className="text-xs">{SCORE_LABELS[key]}</Label>
                      <span className="text-xs text-slate-500">{personaForm[key as keyof typeof personaForm]}/5</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={personaForm[key as keyof typeof personaForm] as number}
                      onChange={(e) =>
                        setPersonaForm((f) => ({ ...f, [key]: parseInt(e.target.value) }))
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <p className="text-xs text-slate-500 mb-2">Preview</p>
              <PersonaRadarChart persona={personaForm} size={250} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPersonaModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePersona} disabled={savingPersona}>
              {savingPersona ? 'Saving…' : 'Save Persona'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
