'use client';

import { use, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Home, Database, GitBranch, Plus, Minus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PrismaField {
  name: string;
  type: string;
  optional: boolean;
  isList: boolean;
  attributes: string[];
}
interface PrismaModel { name: string; fields: PrismaField[] }
interface SqlTable   { name: string; columns: string[] }
interface SchemaEntry { source: string; data?: any; error?: string }

// ─── Relation helpers ─────────────────────────────────────────────────────────

const SCALARS = new Set(['String','Int','Float','Boolean','DateTime','Json','Bytes','Decimal','BigInt']);

function buildPrismaRelationMap(models: PrismaModel[]): Record<string, string[]> {
  const names = new Set(models.map(m => m.name));
  const map: Record<string, string[]> = {};
  for (const model of models) {
    for (const f of model.fields) {
      if (names.has(f.type) && !SCALARS.has(f.type)) {
        (map[model.name] ??= []).push(f.type);
      }
    }
  }
  return map;
}

function buildSqlRelationMap(tables: SqlTable[]): Record<string, string[]> {
  const names = new Set(tables.map(t => t.name.toLowerCase()));
  const map: Record<string, string[]> = {};
  for (const table of tables) {
    for (const col of table.columns) {
      const m = col.match(/REFERENCES\s+["'`]?(\w+)["'`]?/i);
      if (m && names.has(m[1].toLowerCase()) && m[1].toLowerCase() !== table.name.toLowerCase()) {
        (map[table.name] ??= []).push(m[1]);
      }
    }
  }
  return map;
}

function getRelated(name: string, map: Record<string, string[]>): string[] {
  const s = new Set<string>();
  (map[name] ?? []).forEach(r => s.add(r));
  for (const [model, refs] of Object.entries(map)) {
    if (refs.includes(name)) s.add(model);
  }
  s.delete(name);
  return Array.from(s);
}

// ─── Board constants ──────────────────────────────────────────────────────────

const CANVAS = 4000;
const CX = CANVAS / 2;
const CY = CANVAS / 2;
const CARD_W = 280;
const RADIUS = 400;

function cardHeight(fieldCount: number) { return 44 + fieldCount * 22 + 12; }

// ─── Card component ───────────────────────────────────────────────────────────

function PrismaCard({
  model, role, relatedFields,
}: {
  model: PrismaModel;
  role: 'selected' | 'related' | 'none';
  relatedFields: Set<string>;
}) {
  return (
    <div
      style={{ width: CARD_W }}
      className={cn(
        'rounded-xl border bg-white shadow-sm select-none transition-all duration-150',
        role === 'selected' && 'border-blue-400 ring-2 ring-blue-200 shadow-md',
        role === 'related'  && 'border-emerald-400 ring-2 ring-emerald-100 shadow-sm',
        role === 'none'     && 'border-slate-200',
      )}
    >
      <div className={cn(
        'px-3 py-2.5 border-b rounded-t-xl font-semibold text-sm',
        role === 'selected' && 'bg-blue-50  border-blue-200  text-blue-700',
        role === 'related'  && 'bg-emerald-50 border-emerald-200 text-emerald-700',
        role === 'none'     && 'bg-slate-50  border-slate-100  text-slate-800',
      )}>
        {model.name}
      </div>
      <div className="px-3 py-2 space-y-1">
        {model.fields.map(f => {
          const isRel = !SCALARS.has(f.type);
          const isHighlight = isRel && relatedFields.has(f.type);
          return (
            <div key={f.name} className="flex items-baseline gap-2 min-w-0">
              <span className={cn('text-xs truncate flex-shrink-0 max-w-[48%]',
                f.attributes.some(a => a.startsWith('@id')) ? 'font-semibold text-slate-800' : 'text-slate-600'
              )}>
                {f.name}
              </span>
              <span className={cn('text-xs truncate',
                isHighlight               && 'text-emerald-600 font-medium',
                isRel && !isHighlight     && 'text-purple-500',
                !isRel                    && 'text-slate-400',
              )}>
                {f.type}{f.optional ? '?' : ''}{f.isList ? '[]' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SqlCard({
  table, role,
}: {
  table: SqlTable;
  role: 'selected' | 'related' | 'none';
}) {
  return (
    <div
      style={{ width: CARD_W }}
      className={cn(
        'rounded-xl border bg-white shadow-sm select-none transition-all duration-150',
        role === 'selected' && 'border-blue-400 ring-2 ring-blue-200 shadow-md',
        role === 'related'  && 'border-emerald-400 ring-2 ring-emerald-100 shadow-sm',
        role === 'none'     && 'border-slate-200',
      )}
    >
      <div className={cn(
        'px-3 py-2.5 border-b rounded-t-xl font-semibold text-sm',
        role === 'selected' && 'bg-blue-50  border-blue-200  text-blue-700',
        role === 'related'  && 'bg-emerald-50 border-emerald-200 text-emerald-700',
        role === 'none'     && 'bg-slate-50  border-slate-100  text-slate-800',
      )}>
        {table.name}
      </div>
      <div className="px-3 py-2 space-y-1">
        {table.columns.map((col, i) => {
          const isFK = /REFERENCES/i.test(col);
          return (
            <div key={i} className={cn('text-xs truncate',
              isFK ? 'text-purple-500' : 'text-slate-500'
            )}>
              {col.trim()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchemaViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router   = useRouter();

  const [repo,           setRepo]           = useState<any>(null);
  const [branches,       setBranches]       = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [schemas,        setSchemas]        = useState<SchemaEntry[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [loading,        setLoading]        = useState(true);
  const [branchLoading,  setBranchLoading]  = useState(false);

  useEffect(() => {
    if (user) {
      fetch(`/api/repos/${id}`).then(r => r.json()).then(d => setRepo(d.repo));
      fetch(`/api/repos/${id}/branches`).then(r => r.json()).then(d => {
        const list = d.branches ?? [];
        setBranches(list);
        if (list.length) setSelectedBranch(list[0].branch);
      });
    }
  }, [user, id]);

  useEffect(() => {
    if (!selectedBranch) return;
    setBranchLoading(true);
    fetch(`/api/repos/${id}/schema?branch=${encodeURIComponent(selectedBranch)}`)
      .then(r => r.json())
      .then(d => {
        const list: SchemaEntry[] = d.schemas ?? [];
        setSchemas(list);
        setSelectedSource(list[0]?.source ?? '');
      })
      .finally(() => { setBranchLoading(false); setLoading(false); });
  }, [selectedBranch, id]);

  const activeSchema = schemas.find(s => s.source === selectedSource);
  const schemaData   = activeSchema?.data;

  // entity names for the horizontal list
  const allNames: string[] = useMemo(() => {
    if (!schemaData) return [];
    if (schemaData.type === 'prisma') return (schemaData.models ?? []).map((m: PrismaModel) => m.name);
    if (schemaData.type === 'sql')    return (schemaData.tables ?? []).map((t: SqlTable) => t.name);
    return [];
  }, [schemaData]);

  // board helpers
  const prismaRelationMap = useMemo(
    () => schemaData?.type === 'prisma' ? buildPrismaRelationMap(schemaData.models ?? []) : {},
    [schemaData]
  );
  const sqlRelationMap = useMemo(
    () => schemaData?.type === 'sql' ? buildSqlRelationMap(schemaData.tables ?? []) : {},
    [schemaData]
  );

  const relationMap = schemaData?.type === 'prisma' ? prismaRelationMap : sqlRelationMap;

  const getFieldCount = useCallback((name: string) => {
    if (schemaData?.type === 'prisma') {
      return (schemaData.models ?? []).find((m: PrismaModel) => m.name === name)?.fields.length ?? 0;
    }
    if (schemaData?.type === 'sql') {
      return (schemaData.tables ?? []).find((t: SqlTable) => t.name === name)?.columns.length ?? 0;
    }
    return 0;
  }, [schemaData]);

  const renderCard = useCallback((
    name: string,
    role: 'selected' | 'related' | 'none',
    relatedFields: Set<string>,
  ) => {
    if (schemaData?.type === 'prisma') {
      const model = (schemaData.models ?? []).find((m: PrismaModel) => m.name === name);
      if (!model) return null;
      return <PrismaCard model={model} role={role} relatedFields={relatedFields} />;
    }
    if (schemaData?.type === 'sql') {
      const table = (schemaData.tables ?? []).find((t: SqlTable) => t.name === name);
      if (!table) return null;
      return <SqlCard table={table} role={role} />;
    }
    return null;
  }, [schemaData]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
    </div>
  );

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">

      {/* ── Nav bar ── */}
      <div className="border-b bg-white shadow-sm flex-shrink-0">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/repos')}>
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600" />
              <span className="font-semibold text-slate-900">{repo?.name}</span>
              <span className="text-xs text-slate-400">/ Schema</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {schemas.length > 1 && (
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schemas.map(s => (
                    <SelectItem key={s.source} value={s.source}>
                      {s.source.split('/').pop()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={branchLoading}>
              <SelectTrigger className="w-44">
                <GitBranch className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(b => (
                  <SelectItem key={b.branch} value={b.branch}>{b.branch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Board ── */}
      {branchLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        </div>
      ) : schemas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <Database className="w-12 h-12 mb-3 text-slate-300" />
          <p className="text-base font-medium text-slate-500">No schema config found</p>
          <p className="text-sm mt-1">
            Add <code className="bg-slate-100 px-1 rounded">structure.database.schemas</code> to{' '}
            <code className="bg-slate-100 px-1 rounded">.distill.yaml</code>
          </p>
        </div>
      ) : activeSchema?.error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-red-500">Failed to read schema: {activeSchema.error}</p>
        </div>
      ) : (
        <BoardWithSelection
          key={selectedSource + selectedBranch}
          allNames={allNames}
          relationMap={relationMap}
          getFieldCount={getFieldCount}
          renderCard={renderCard}
        />
      )}
    </div>
  );
}

// Chip is in a separate component so it can call setSelected on the shared board
// We lift selection up into a wrapper so Board + chips share state.

function BoardWithSelection({
  allNames, relationMap, getFieldCount, renderCard,
}: {
  allNames: string[];
  relationMap: Record<string, string[]>;
  getFieldCount: (name: string) => number;
  renderCard: (name: string, role: 'selected'|'related'|'none', relatedFields: Set<string>) => React.ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [search,   setSearch]   = useState('');
  const chipBarRef      = useRef<HTMLDivElement>(null);
  const chipDragging    = useRef(false);
  const chipHasDragged  = useRef(false);
  const chipDragStartX  = useRef(0);
  const chipScrollStart = useRef(0);

  const onChipBarMouseDown = (e: React.MouseEvent) => {
    chipDragging.current   = true;
    chipHasDragged.current = false;
    chipDragStartX.current  = e.clientX;
    chipScrollStart.current = chipBarRef.current?.scrollLeft ?? 0;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!chipDragging.current || !chipBarRef.current) return;
      const dx = e.clientX - chipDragStartX.current;
      if (Math.abs(dx) > 3) chipHasDragged.current = true;
      chipBarRef.current.scrollLeft = chipScrollStart.current - dx;
    };
    const onUp = () => { chipDragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const filtered = useMemo(
    () => allNames.filter(n => n.toLowerCase().includes(search.toLowerCase())),
    [allNames, search]
  );
  const containerRef  = useRef<HTMLDivElement>(null);
  const isDragging    = useRef(false);
  const hasDragged    = useRef(false);
  const dragStart     = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  // Refs so the wheel handler always reads the latest values without stale closure
  const zoomRef = useRef(zoom);
  const panRef  = useRef(pan);
  zoomRef.current = zoom;
  panRef.current  = pan;

  // Card drag state
  const [userPositions, setUserPositions] = useState<Record<string, {x:number;y:number}>>({});
  const draggingCard  = useRef<string | null>(null);
  const cardDragStart = useRef({ mouseX: 0, mouseY: 0, cardX: 0, cardY: 0 });

  // Reset manual positions when selection changes
  useEffect(() => { setUserPositions({}); }, [selected]);

  // Document-level card drag handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingCard.current) return;
      const dx = (e.clientX - cardDragStart.current.mouseX) / zoomRef.current;
      const dy = (e.clientY - cardDragStart.current.mouseY) / zoomRef.current;
      setUserPositions(prev => ({
        ...prev,
        [draggingCard.current!]: {
          x: cardDragStart.current.cardX + dx,
          y: cardDragStart.current.cardY + dy,
        },
      }));
    };
    const onUp = () => { draggingCard.current = null; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const recenter = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    setPan({ x: clientWidth / 2 - CX * zoom, y: clientHeight / 2 - CY * zoom });
  }, [zoom]);

  useEffect(() => { recenter(); }, []); // eslint-disable-line

  useEffect(() => {
    if (selected) {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      setPan({ x: clientWidth / 2 - CX * zoom, y: clientHeight / 2 - CY * zoom });
    }
  }, [selected]); // eslint-disable-line

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const oldZoom = zoomRef.current;
      const newZoom = Math.min(2, Math.max(0.2, oldZoom + (e.deltaY > 0 ? -0.08 : 0.08)));
      const ratio   = newZoom / oldZoom;
      const rect    = el.getBoundingClientRect();
      const cx      = e.clientX - rect.left;
      const cy      = e.clientY - rect.top;
      // Keep the canvas point under the cursor fixed
      setPan({ x: cx - (cx - panRef.current.x) * ratio, y: cy - (cy - panRef.current.y) * ratio });
      setZoom(newZoom);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const up = () => { isDragging.current = false; };
    document.addEventListener('mouseup', up);
    return () => document.removeEventListener('mouseup', up);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    hasDragged.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) hasDragged.current = true;
    setPan({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
  };

  const onBoardClick = () => {
    if (!hasDragged.current) setSelected(null);
  };

  const changeZoom = (delta: number) => {
    if (!containerRef.current) return;
    const oldZoom = zoomRef.current;
    const newZoom = Math.min(2, Math.max(0.2, oldZoom + delta));
    const ratio   = newZoom / oldZoom;
    const { clientWidth, clientHeight } = containerRef.current;
    const cx = clientWidth / 2;
    const cy = clientHeight / 2;
    setPan({ x: cx - (cx - panRef.current.x) * ratio, y: cy - (cy - panRef.current.y) * ratio });
    setZoom(newZoom);
  };

  const related    = selected ? getRelated(selected, relationMap) : [];
  const relatedSet = new Set(related);

  // Compute initial circle layout (resets when selection changes)
  const positions = useMemo(() => {
    if (!selected) return {} as Record<string, {x:number;y:number}>;
    const pos: Record<string, {x:number;y:number}> = {};
    const selH = cardHeight(getFieldCount(selected));
    pos[selected] = { x: CX - CARD_W / 2, y: CY - selH / 2 };

    const relatedHeights = related.map(n => cardHeight(getFieldCount(n)));
    const maxRelH = relatedHeights.length > 0 ? Math.max(...relatedHeights) : 0;
    const radiusForHeight = (selH + maxRelH) / 2 + 60;
    const radiusForWidth  = related.length > 1
      ? (CARD_W + 50) / (2 * Math.sin(Math.PI / related.length))
      : 320;
    const radius = Math.max(RADIUS, radiusForHeight, radiusForWidth);

    related.forEach((name, i) => {
      const angle = (2 * Math.PI * i) / related.length - Math.PI / 2;
      const h = cardHeight(getFieldCount(name));
      pos[name] = {
        x: CX + Math.cos(angle) * radius - CARD_W / 2,
        y: CY + Math.sin(angle) * radius - h / 2,
      };
    });
    return pos;
  }, [selected, related, getFieldCount]); // eslint-disable-line

  // Merge user-dragged overrides on top of computed positions
  const effectivePositions: Record<string, {x:number;y:number}> = { ...positions };
  for (const [name, pos] of Object.entries(userPositions)) {
    if (effectivePositions[name]) effectivePositions[name] = pos;
  }

  // Lines follow effective (possibly dragged) positions
  const lines = selected ? related.map(name => {
    const sp = effectivePositions[selected];
    const rp = effectivePositions[name];
    if (!sp || !rp) return null;
    return {
      key: name,
      x1: sp.x + CARD_W / 2, y1: sp.y + cardHeight(getFieldCount(selected)) / 2,
      x2: rp.x + CARD_W / 2, y2: rp.y + cardHeight(getFieldCount(name)) / 2,
    };
  }).filter((l): l is NonNullable<typeof l> => l !== null) : [];

  const visible = selected ? [selected, ...related] : [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Chip bar */}
      <div className="border-b bg-white flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs border border-slate-200 rounded-md w-36 focus:outline-none focus:border-blue-300"
            />
          </div>
          <div
            ref={chipBarRef}
            className="flex gap-1.5 overflow-x-auto flex-1 cursor-grab active:cursor-grabbing"
            style={{ scrollbarWidth: 'none' }}
            onMouseDown={onChipBarMouseDown}
          >
            {filtered.length === 0 && (
              <span className="text-xs text-slate-400 py-1">No matches</span>
            )}
            {filtered.map(name => (
              <button
                key={name}
                onClick={() => { if (!chipHasDragged.current) setSelected(selected === name ? null : name); }}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-full border whitespace-nowrap transition-colors flex-shrink-0',
                  selected === name
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : relatedSet.has(name)
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-[#f8f9fb]" style={{
        backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}>
        <div
          ref={containerRef}
          className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onClick={onBoardClick}
        >
          <div style={{
            width: CANVAS, height: CANVAS, position: 'relative',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0', willChange: 'transform',
          }}>
            {/* Lines */}
            {selected && lines.length > 0 && (
              <svg style={{ position:'absolute', inset:0, width:CANVAS, height:CANVAS, pointerEvents:'none' }}>
                <defs>
                  <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#10b981" opacity="0.5" />
                  </marker>
                </defs>
                {lines.map(l => (
                  <line key={l.key}
                    x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                    stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.4"
                    strokeDasharray="6 4" markerEnd="url(#arr)"
                  />
                ))}
              </svg>
            )}

            {/* Cards */}
            {visible.map(name => {
              const pos = effectivePositions[name];
              if (!pos) return null;
              const role = name === selected ? 'selected' : 'related';
              return (
                <div
                  key={name}
                  style={{ position:'absolute', left:pos.x, top:pos.y, cursor:'move' }}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => {
                    e.stopPropagation();
                    draggingCard.current = name;
                    cardDragStart.current = { mouseX: e.clientX, mouseY: e.clientY, cardX: pos.x, cardY: pos.y };
                  }}
                >
                  {renderCard(name, role, role === 'selected' ? relatedSet : new Set(selected ? [selected] : []))}
                </div>
              );
            })}

            {!selected && (
              <div style={{ position:'absolute', left:CX, top:CY, transform:'translate(-50%,-50%)' }}
                className="text-slate-300 text-sm select-none pointer-events-none text-center"
              >
                <Database className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Pick a model from the list above
              </div>
            )}
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-0 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <button onClick={() => changeZoom(0.15)} className="p-2 hover:bg-slate-50 transition-colors" title="Zoom in">
            <Plus className="w-4 h-4 text-slate-600" />
          </button>
          <div className="text-xs text-center text-slate-400 py-0.5 border-y border-slate-100 px-2 select-none">
            {Math.round(zoom * 100)}%
          </div>
          <button onClick={() => changeZoom(-0.15)} className="p-2 hover:bg-slate-50 transition-colors" title="Zoom out">
            <Minus className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

