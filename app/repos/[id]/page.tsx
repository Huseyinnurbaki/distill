'use client';

import { use, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GitBranch, Square, SquarePen, PanelLeft, FolderGit2, RefreshCw, GitCompare, ArrowDown, ArrowUp, Trash2, FileText, ChevronLeft, ChevronRight, Download, MoreVertical, FolderOpen, Folder, File, Check, ChevronsUpDown, Copy, FoldVertical, MessageSquarePlus, Info, X, Settings, Network, Database, Route, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MarkdownMessage } from '@/components/markdown-message';
import { UserMessageContent } from '@/components/user-message-content';
import { PersonaRadarChart } from '@/components/persona-radar-chart';
import { QueryResultModal } from '@/components/query-result-modal';
import type { QueryResult } from '@/components/sql-code-block';

interface Chat {
  id: string;
  type: string;
  title: string;
  branch?: string;
  commitSha?: string;
  leftBranch?: string;
  rightBranch?: string;
  includeContext?: boolean;
  personaName?: string;
  personaDescription?: string;
  activeDatasourceId?: string | null;
  createdAt: string;
}

interface Datasource {
  id: string;
  name: string;
  type: string;
  canExecute: boolean;
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

interface Message {
  id: string;
  role: string;
  content: string;
  model?: string;
  provider?: string;
  error?: boolean;
}

function modelDisplayName(provider?: string, model?: string): string {
  if (!model) return 'Unknown model';
  const names: Record<string, string> = {
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4o': 'GPT-4o',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'claude-3-5-sonnet-latest': 'Claude 3.5 Sonnet',
    'claude-3-opus-latest': 'Claude 3 Opus',
    'claude-3-haiku-20240307': 'Claude 3 Haiku',
  };
  return names[model] ?? model;
}

export default function RepoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const [repo, setRepo] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('');
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fileExplorerOpen, setFileExplorerOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('fileExplorerOpen');
    return stored === null ? true : stored === 'true';
  });

  const setFileExplorerOpenPersisted = (open: boolean) => {
    localStorage.setItem('fileExplorerOpen', String(open));
    setFileExplorerOpen(open);
  };

  const setAutoInjectPersonaPersisted = (val: boolean) => {
    localStorage.setItem(`persona_enabled_${id}`, String(val));
    setAutoInjectPersona(val);
  };

  const setSelectedPersonaIdPersisted = (id: string) => {
    localStorage.setItem(`persona_id_${id}`, id);
    setSelectedPersonaId(id);
  };
  const [repoFiles, setRepoFiles] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string } | null>(null);
  const [newChatSelectorOpen, setNewChatSelectorOpen] = useState(false);
  const [sidebarNewChatOpen, setSidebarNewChatOpen] = useState(false);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [newChatBranch, setNewChatBranch] = useState('');
  const [newChatIncludeContext, setNewChatIncludeContext] = useState(true);
  const [autoIncludeContext, setAutoIncludeContext] = useState(true);
  const [contextMessage, setContextMessage] = useState<{ userMsg: string; aiMsg: string; fromBranch: string } | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [autoInjectPersona, setAutoInjectPersona] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(`persona_enabled_${id}`);
    return stored === null ? true : stored === 'true';
  });
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`persona_id_${id}`) ?? '';
  });
  const [newChatPersonaId, setNewChatPersonaId] = useState<string>('');
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [chatDatasources, setChatDatasources] = useState<Datasource[]>([]);
  const [activeDatasource, setActiveDatasource] = useState<Datasource | null>(null);
  const [dbPickerOpen, setDbPickerOpen] = useState(false);
  const [queryResults, setQueryResults] = useState<Record<string, QueryResult>>({});
  const [queryResultOpen, setQueryResultOpen] = useState<QueryResult | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [structures, setStructures] = useState<any[]>([]);
  const [structureScanning, setStructureScanning] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'files' | 'structure'>('files');
  const [expandedStructures, setExpandedStructures] = useState<Set<string>>(new Set());

  const toggleStructureSection = (id: string) => {
    setExpandedStructures((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-grow the chat input up to ~5 rows, then scroll inside it.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  // Popup is shown/hidden imperatively (no state) so selection is never disturbed by re-renders.
  const popupRef = useRef<HTMLDivElement>(null);
  const selectedTextRef = useRef<string>('');
  const shouldScrollToLastUserRef = useRef(false);
  const scrollSpacerRef = useRef<HTMLDivElement>(null);
  const [quotedText, setQuotedText] = useState<string | null>(null);

  const availableCommands = [
    {
      command: '/update-context',
      description: 'Refresh chat with latest repository docs and guidelines',
      enabled: activeChat?.includeContext && repo?.contextUpdatedAt,
    },
    {
      command: '/persona',
      description: 'Switch the active persona for this chat',
      enabled: personas.length > 0,
    },
    {
      command: '/db',
      description: 'Switch active datasource for this chat',
      enabled: chatDatasources.length > 1,
    },
  ];

  const filteredCommands = input.startsWith('/')
    ? availableCommands.filter((cmd) => cmd.command.startsWith(input.toLowerCase()))
    : availableCommands;

  useEffect(() => {
    if (user) {
      fetchRepo();
      fetchBranches();
      fetchChats();
      fetchAdminDefaults();
      fetchStructures();
      fetchPersonas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  useEffect(() => {
    if (activeChat) {
      fetchChatDatasources(activeChat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id]);

  const fetchAdminDefaults = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.settings?.defaultAnthropicModel) {
        setModel(data.settings.defaultAnthropicModel);
      }
    } catch {
      // fall through to model list fallback
    }
  };

  const fetchChatDatasources = async (chat: Chat) => {
    if (!chat.branch) return;
    try {
      const res = await fetch(`/api/repos/${id}/datasources?branch=${encodeURIComponent(chat.branch)}`);
      const data = await res.json();
      const list: Datasource[] = data.datasources ?? [];
      setChatDatasources(list);
      const active = list.find((d) => d.id === chat.activeDatasourceId) ?? list[0] ?? null;
      setActiveDatasource(active);
    } catch {
      setChatDatasources([]);
      setActiveDatasource(null);
    }
  };

  const handleDatasourceSwitch = async (ds: Datasource) => {
    if (!activeChat) return;
    try {
      await fetch(`/api/chats/${activeChat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeDatasourceId: ds.id }),
      });
      setActiveChat((prev) => prev ? { ...prev, activeDatasourceId: ds.id } : prev);
      setActiveDatasource(ds);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'datasource-switch', content: ds.name },
      ]);
      setDbPickerOpen(false);
      toast.success(`Switched to ${ds.name}`);
    } catch {
      toast.error('Failed to switch datasource');
    }
  };

  const fetchPersonas = async () => {
    try {
      const res = await fetch('/api/personas');
      const data = await res.json();
      const list: Persona[] = data.personas ?? [];
      setPersonas(list);
      const defaultPersona = list.find((p) => p.isDefault) ?? list[0];
      if (defaultPersona) {
        setSelectedPersonaId((prev) => prev || defaultPersona.id);
        setNewChatPersonaId((prev) => prev || defaultPersona.id);
      }
    } catch {
      // personas unavailable
    }
  };

  useEffect(() => {
    fetchModels(provider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const fetchModels = async (p: string) => {
    setModelsLoading(true);
    try {
      const res = await fetch(`/api/models?provider=${p}`);
      const data = await res.json();
      if (data.models?.length) {
        setAvailableModels(data.models);
        // Keep current model if valid, otherwise fall back to first in list
        setModel((prev) => prev && data.models.find((m: { id: string }) => m.id === prev) ? prev : data.models[0].id);
      }
    } catch {
      // Keep existing model selection on failure
    } finally {
      setModelsLoading(false);
    }
  };

  // Restore active chat from localStorage after chats are loaded
  useEffect(() => {
    if (chats.length > 0 && !activeChat) {
      const savedChatId = localStorage.getItem(`activeChat_${id}`);
      if (savedChatId) {
        const chat = chats.find(c => c.id === savedChatId);
        if (chat) {
          setActiveChat(chat);
          fetchMessages(chat.id);
        } else {
          // Chat was deleted, clear localStorage
          localStorage.removeItem(`activeChat_${id}`);
        }
      }
    }
  }, [chats, activeChat, id]);

  useEffect(() => {
    // Auto-select first available branch (sorted, so main/master comes first)
    if (branches.length > 0 && !selectedBranch) {
      setSelectedBranch(branches[0].branch);
    }
  }, [branches, selectedBranch]);

  useEffect(() => {
    if (selectedBranch && activeChat) {
      fetchRepoFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, activeChat]);

  const fetchRepoFiles = async () => {
    if (!selectedBranch) return;
    try {
      const res = await fetch(`/api/repos/${id}/files?branch=${selectedBranch}&all=true`);
      const data = await res.json();
      setRepoFiles(data.files?.map((f: any) => f.path) || []);
    } catch (error) {
      console.error('Failed to fetch repo files:', error);
    }
  };

  const buildFileTree = (files: string[]) => {
    const tree: any = {};
    files.forEach(file => {
      const parts = file.split('/');
      let current = tree;
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // It's a file
          if (!current.__files) current.__files = [];
          current.__files.push(part);
        } else {
          // It's a folder
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      });
    });
    return tree;
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const viewFile = async (filePath: string) => {
    if (!selectedBranch) return;
    try {
      const res = await fetch(
        `/api/repos/${id}/files/${encodeURIComponent(filePath)}?branch=${selectedBranch}`
      );
      const data = await res.json();
      setViewingFile({ path: filePath, content: data.content });
    } catch (error) {
      toast.error('Failed to load file');
    }
  };

  const highlightAndOpenFile = useCallback((filePath: string) => {
    // Check if file exists
    if (!repoFiles.includes(filePath)) {
      toast.error(`File not found: ${filePath}`);
      return;
    }

    toast.success(`Opening ${filePath}...`);

    // Open file explorer if closed
    setFileExplorerOpenPersisted(true);

    // Expand all parent folders
    const parts = filePath.split('/');
    setExpandedFolders((prev) => {
      const newExpanded = new Set(prev);
      for (let i = 0; i < parts.length - 1; i++) {
        newExpanded.add(parts.slice(0, i + 1).join('/'));
      }
      return newExpanded;
    });

    // Highlight the file briefly
    setTimeout(() => {
      const element = document.querySelector(`[data-file-path="${filePath}"]`);
      console.log('Found element?', !!element);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('bg-yellow-200');
        setTimeout(() => {
          element.classList.remove('bg-yellow-200');
        }, 2000);
      }
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoFiles]);

  const renderContentWithClickablePaths = (content: string) => {
    const parts: (string | JSX.Element)[] = [];
    const pathPattern = /([a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-\.]+)+)/g;

    let lastIndex = 0;
    let match;

    while ((match = pathPattern.exec(content)) !== null) {
      const path = match[1];

      // Add text before the path
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      // Check if this path exists in our repo files
      if (repoFiles.includes(path)) {
        parts.push(
          <button
            key={`path-${match.index}`}
            onClick={() => highlightAndOpenFile(path)}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200 rounded border border-blue-200 font-mono text-sm no-underline cursor-pointer transition-colors mx-1"
          >
            📄 {path}
          </button>
        );
      } else {
        parts.push(path);
      }

      lastIndex = match.index + path.length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  const copyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    toast.success(`Path copied: ${path}`);
  };

  const openNewChatModal = (msgIndex: number) => {
    // Pre-fill with current selections
    setNewChatBranch(selectedBranch);
    setNewChatIncludeContext(activeChat?.includeContext ?? true);

    // Capture context from the current conversation
    const aiMessage = messages[msgIndex];
    // Find the user message that prompted this response
    let userMessage = '';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessage = messages[i].content;
        break;
      }
    }

    setContextMessage({
      userMsg: userMessage,
      aiMsg: aiMessage.content,
      fromBranch: activeChat?.branch || selectedBranch,
    });

    setNewChatModalOpen(true);
  };

  const createNewChatFromModal = async () => {
    if (!newChatBranch) {
      toast.error('Please select a branch');
      return;
    }

    try {
      const res = await fetch(`/api/repos/${id}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: newChatBranch,
          includeContext: newChatIncludeContext,
          personaId: autoInjectPersona ? newChatPersonaId : undefined,
        }),
      });
      const data = await res.json();
      const newChatId = data.chat.id;

      // Add context message to the new chat
      if (contextMessage) {
        const isSameBranch = contextMessage.fromBranch === newChatBranch;

        // Create a summary (first 3 sentences or ~200 chars)
        const createSummary = (text: string) => {
          const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
          const summary = sentences.slice(0, 3).join(' ').trim();
          return summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
        };

        const aiResponseSummary = createSummary(contextMessage.aiMsg);

        const contextText = isSameBranch
          ? `I see we're continuing from our previous conversation where you asked:

> ${contextMessage.userMsg}

**Response was:**

${contextMessage.aiMsg}

---

We're still on the **${newChatBranch}** branch. What would you like to do from here?`
          : `I see we're switching branches! Let me provide context from our previous conversation:

**You asked on \`${contextMessage.fromBranch}\`:**
> ${contextMessage.userMsg}

**Response was:**

${contextMessage.aiMsg}

---

Now we're on **\`${newChatBranch}\`**. The code and files may be different here. What would you like to explore or work on in this branch?`;

        // Create initial assistant message with context via API
        await fetch(`/api/chats/${newChatId}/messages/context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: contextText,
            model,
            provider,
          }),
        });
      }

      // New chat keeps the current provider/model selection
      setSelectedBranch(newChatBranch);

      setActiveChat(data.chat);
      setTimeout(() => inputRef.current?.focus(), 100);

      // Fetch messages to get the context message we just created
      await fetchMessages(newChatId);

      localStorage.setItem(`activeChat_${id}`, data.chat.id);
      fetchChats();
      setNewChatModalOpen(false);
      toast.success(`New chat created on ${newChatBranch}`);
    } catch (error: any) {
      console.error('Create chat error:', error);
      toast.error(error.message || 'Failed to create chat');
    }
  };

  const renderFileTree = (tree: any, basePath = '', level = 0) => {
    const folders = Object.keys(tree).filter(key => key !== '__files');
    const files = tree.__files || [];

    return (
      <div>
        {folders.map(folder => {
          const folderPath = basePath ? `${basePath}/${folder}` : folder;
          const isExpanded = expandedFolders.has(folderPath);
          return (
            <div key={folderPath}>
              <div
                className="w-full flex items-center gap-1 px-2 py-1 hover:bg-slate-100 text-sm group"
                style={{ paddingLeft: `${level * 12 + 8}px` }}
              >
                <button
                  onClick={() => toggleFolder(folderPath)}
                  className="flex-1 flex items-center gap-1 text-left min-w-0"
                >
                  {isExpanded ? (
                    <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  )}
                  <span className="truncate">{folder}</span>
                </button>
                <button
                  onClick={(e) => copyPath(folderPath, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-opacity flex-shrink-0"
                  title="Copy path"
                >
                  <Copy className="w-3 h-3 text-slate-500" />
                </button>
              </div>
              {isExpanded && renderFileTree(tree[folder], folderPath, level + 1)}
            </div>
          );
        })}
        {files.map((file: string) => {
          const filePath = basePath ? `${basePath}/${file}` : file;
          return (
            <div
              key={filePath}
              className="w-full flex items-center gap-1 px-2 py-1 hover:bg-slate-100 text-sm transition-colors group"
              style={{ paddingLeft: `${level * 12 + 8}px` }}
              data-file-path={filePath}
            >
              <button
                onClick={() => viewFile(filePath)}
                className="flex-1 flex items-center gap-1 text-left min-w-0"
              >
                <File className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="truncate">{file}</span>
              </button>
              <button
                onClick={(e) => copyPath(filePath, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-opacity flex-shrink-0"
                title="Copy path"
              >
                <Copy className="w-3 h-3 text-slate-500" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (shouldScrollToLastUserRef.current) {
      shouldScrollToLastUserRef.current = false;
      const scrollEl = scrollViewportRef.current;
      if (scrollEl) {
        const userMsgs = scrollEl.querySelectorAll<HTMLElement>('[data-message-role="user"]');
        const lastUserMsg = userMsgs[userMsgs.length - 1];
        if (lastUserMsg) {
          // Expand spacer instantly (no transition) so the layout is ready before
          // scrollIntoView fires. The spacer collapses with a transition after streaming.
          if (scrollSpacerRef.current) {
            scrollSpacerRef.current.style.transition = 'none';
            scrollSpacerRef.current.style.height = scrollEl.clientHeight + 'px';
          }
          requestAnimationFrame(() => {
            lastUserMsg.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
          return;
        }
      }
    }
    setTimeout(handleScroll, 100);
  }, [messages, streaming]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let downX = 0;
    let downY = 0;

    const hidePopup = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (popupRef.current) popupRef.current.style.display = 'none';
      // Do NOT clear selectedTextRef here — the click handler on the popup button
      // fires after mousedown, so it still needs to read the text.
    };

    const scheduleShowPopup = (clientX: number, clientY: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const selection = window.getSelection();
        const text = selection?.toString().trim() ?? '';
        if (!text || selection?.isCollapsed) return;
        if (!scrollViewportRef.current?.contains(selection?.anchorNode ?? null)) return;
        // Clear any previous text before storing the new selection.
        selectedTextRef.current = text;
        const popup = popupRef.current;
        if (!popup) return;
        popup.style.left = `${clientX}px`;
        popup.style.top = `${clientY}px`;
        popup.style.display = 'flex';
      }, 100);
    };

    const handleMouseDown = (e: MouseEvent) => {
      // If the click is inside the popup, leave everything alone — the button's
      // own onClick handler will run and needs selectedTextRef intact.
      if (popupRef.current?.contains(e.target as Node)) return;
      downX = e.clientX;
      downY = e.clientY;
      hidePopup();
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return;
      if (!scrollViewportRef.current?.contains(e.target as Node)) return;
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist < 5) return;
      scheduleShowPopup(e.clientX, e.clientY);
    };

    // detail >= 2 catches double-click (2) and triple-click (3, selects whole line).
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return;
      if (e.detail < 2) return;
      if (!scrollViewportRef.current?.contains(e.target as Node)) return;
      scheduleShowPopup(e.clientX, e.clientY);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  const fetchRepo = async () => {
    try {
      const res = await fetch(`/api/repos/${id}`);
      const data = await res.json();
      setRepo(data.repo);
    } catch (error) {
      toast.error('Failed to fetch repository');
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(`/api/repos/${id}/branches`);
      const data = await res.json();
      console.log('Branches response:', data);
      if (data.error) {
        console.error('Branches API error:', data.error);
        toast.error(`Failed to fetch branches: ${data.error}`);
        setBranches([]);
      } else {
        setBranches(data.branches || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch branches:', error);
      toast.error('Failed to fetch branches');
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch(`/api/repos/${id}/chats`);
      const data = await res.json();
      setChats(data.chats || []);
    } catch (error) {
      toast.error('Failed to fetch chats');
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      const data = await res.json();
      setMessages(data.messages || []);
      // Scroll to bottom after loading so the latest exchange is visible.
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    } catch (error) {
      toast.error('Failed to fetch messages');
    }
  };

  const fetchStructures = async () => {
    try {
      const res = await fetch(`/api/repos/${id}/structure`);
      const data = await res.json();
      setStructures(data.structures || []);
    } catch {
      // no structure data
    }
  };

  const handleScanStructure = async (force = false) => {
    setStructureScanning(true);
    try {
      const res = await fetch(`/api/repos/${id}/structure/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      await fetchStructures();
      if (data.warnings?.length) {
        data.warnings.forEach((w: string) => toast.warning(w));
      } else {
        toast.success(force ? 'Structure force-rescanned' : 'Structure scanned');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to scan structure');
    } finally {
      setStructureScanning(false);
    }
  };

  const handlePull = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/repos/${id}/pull`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to pull');
      toast.success('Repository updated');
      fetchRepo();
      fetchBranches(); // Refresh branches after pull
      if (activeChat) {
        fetchRepoFiles(); // Refresh file tree if chat is active
      }
    } catch (error) {
      toast.error('Failed to pull repository');
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async (branch?: string, includeContext = true) => {
    const branchToUse = branch || selectedBranch;

    if (!branchToUse) {
      toast.error('Please select a branch');
      return;
    }

    try {
      const res = await fetch(`/api/repos/${id}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: branchToUse,
          includeContext,
          personaId: autoInjectPersona ? selectedPersonaId : undefined,
        }),
      });
      const data = await res.json();
      setActiveChat(data.chat);
      setMessages([]);
      setTimeout(() => inputRef.current?.focus(), 100);
      // Save to localStorage
      localStorage.setItem(`activeChat_${id}`, data.chat.id);
      fetchChats();
      toast.success(`New chat created on ${branchToUse}`);
      setNewChatSelectorOpen(false);
      setSidebarNewChatOpen(false);
    } catch (error: any) {
      console.error('Create chat error:', error);
      toast.error(error.message || 'Failed to create chat');
    }
  };

  const handleSelectChat = (chat: Chat) => {
    setActiveChat(chat);
    fetchMessages(chat.id);
    // Save to localStorage
    localStorage.setItem(`activeChat_${id}`, chat.id);
  };


  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the chat when clicking delete

    if (!confirm('Are you sure you want to delete this chat?')) {
      return;
    }

    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');

      // Clear active chat if it was deleted
      if (activeChat?.id === chatId) {
        setActiveChat(null);
        setMessages([]);
        // Clear from localStorage
        localStorage.removeItem(`activeChat_${id}`);
      }

      // Refresh chat list
      fetchChats();
      toast.success('Chat deleted');
    } catch (error) {
      toast.error('Failed to delete chat');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeChat || streaming) return;

    const userMessage = input.trim();

    // Handle /update-context command
    if (userMessage === '/update-context') {
      setInput('');
      await handleUpdateContext();
      return;
    }

    // Handle /persona command
    if (userMessage === '/persona') {
      setInput('');
      setPersonaPickerOpen(true);
      return;
    }

    // Handle /db command
    if (userMessage === '/db') {
      setInput('');
      setDbPickerOpen(true);
      return;
    }

    const activeQuote = quotedText;
    setInput('');
    setQuotedText(null);
    setStreaming(true);

    // Content shown in the chat bubble — includes the quote visually.
    const displayContent = activeQuote
      ? `> ${activeQuote}\n\n${userMessage}`
      : userMessage;

    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: displayContent }]);
    // Signal the useEffect to scroll the new user message to the top once React commits it.
    shouldScrollToLastUserRef.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`/api/chats/${activeChat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: displayContent, provider, model }),
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      setMessages((prev) => [...prev, { id: 'streaming', role: 'assistant', content: '', model, provider }]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim().startsWith('data:'));

        for (const line of lines) {
          const data = line.replace('data:', '').trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              assistantMessage += parsed.content;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === 'streaming' ? { ...msg, content: assistantMessage } : msg
                )
              );
            }
            if (parsed.error) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === 'streaming'
                    ? { ...msg, id: 'error-' + Date.now(), content: parsed.error, error: true }
                    : msg
                )
              );
            }
          } catch { }
        }
      }

      setMessages((prev) =>
        prev.map((msg) => (msg.id === 'streaming' ? { ...msg, id: Date.now().toString() } : msg))
      );
    } catch (error: any) {
      // User stopped the generation — keep whatever streamed so far.
      if (error?.name === 'AbortError') {
        setMessages((prev) =>
          prev.flatMap((msg) => {
            if (msg.id !== 'streaming') return [msg];
            // Drop the empty bubble if nothing streamed before stopping.
            return msg.content ? [{ ...msg, id: Date.now().toString() }] : [];
          })
        );
      } else {
        console.error('Send message error:', error);
        // Replace streaming message with error message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === 'streaming'
              ? {
                ...msg,
                id: 'error-' + Date.now(),
                content: '⚠️ Something went wrong. Please try typing your message again.',
                error: true,
              }
              : msg
          )
        );
        toast.error('Failed to send message');
      }
    } finally {
      abortControllerRef.current = null;
      setStreaming(false);
      // Only collapse the spacer if it has been pushed below the viewport (AI response
      // was long enough to fill the space). If the spacer is still visible, leave it —
      // collapsing a visible spacer causes a jarring jump for short responses.
      if (scrollSpacerRef.current && scrollViewportRef.current) {
        const spacerTop = scrollSpacerRef.current.getBoundingClientRect().top;
        const containerBottom = scrollViewportRef.current.getBoundingClientRect().bottom;
        if (spacerTop >= containerBottom) {
          scrollSpacerRef.current.style.transition = 'none';
          scrollSpacerRef.current.style.height = '0';
        }
      }
    }
  };

  const handleScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScrollToTop = () => {
    scrollViewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!scrollViewportRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current;
    const distanceFromBottom = scrollHeight - clientHeight - scrollTop;
    isAtBottomRef.current = distanceFromBottom < 100;
    setShowScrollButtons(scrollHeight > clientHeight && distanceFromBottom > 100);
    if (popupRef.current) popupRef.current.style.display = 'none';
  };

  const handleQuoteInReply = () => {
    const text = selectedTextRef.current;
    if (!text) return;
    // Normalise to a single line so the \n\n separator stays unambiguous.
    setQuotedText(text.replace(/\s+/g, ' ').trim());
    if (popupRef.current) popupRef.current.style.display = 'none';
    selectedTextRef.current = '';
    window.getSelection()?.removeAllRanges();
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handlePersonaSwitch = async (persona: Persona) => {
    if (!activeChat) return;
    try {
      await fetch(`/api/chats/${activeChat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaName: persona.name, personaDescription: persona.description }),
      });
      setActiveChat((prev) => prev ? { ...prev, personaName: persona.name, personaDescription: persona.description } : prev);
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        role: 'persona-switch',
        content: persona.name,
      }]);
      setPersonaPickerOpen(false);
      toast.success(`Switched to ${persona.name}`);
    } catch {
      toast.error('Failed to switch persona');
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleModelChange = (newModel: string) => {
    if (!newModel || newModel === model) return;
    setModel(newModel);
    if (activeChat) {
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        role: 'model-switch',
        content: modelDisplayName(provider, newModel),
        model: newModel,
        provider,
      }]);
    }
  };

  const handleUpdateContext = async () => {
    if (!activeChat || !repo) return;

    try {
      // Add a system message with the latest context
      const res = await fetch(`/api/chats/${activeChat.id}/messages/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `📚 **Context Updated**\n\nI've refreshed my knowledge with the latest repository documentation and guidelines from the primary branch.\n\nThe context was last updated: ${repo.contextUpdatedAt ? new Date(repo.contextUpdatedAt).toLocaleString() : 'unknown'}\n\nWhat would you like to know?`,
          model,
          provider,
        }),
      });

      if (res.ok) {
        toast.success('Context updated! Latest docs and guidelines loaded.');
        fetchMessages(activeChat.id);
      } else {
        throw new Error('Failed to update context');
      }
    } catch (error) {
      toast.error('Failed to update context');
    }
  };

  const exportMessage = (content: string, format: 'md' | 'pdf' | 'txt') => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'md') {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `response-${timestamp}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported as Markdown');
    } else if (format === 'txt') {
      // Strip markdown formatting for plain text
      const plainText = content
        .replace(/#{1,6}\s/g, '') // Remove headers
        .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.+?)\*/g, '$1') // Remove italic
        .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
        .replace(/`(.+?)`/g, '$1') // Remove inline code
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .trim();

      const blob = new Blob([plainText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `response-${timestamp}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported as Text');
    } else if (format === 'pdf') {
      // For PDF, we'll create a simple HTML document and open print dialog
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Export Response</title>
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                pre { background: #f4f4f4; padding: 12px; border-radius: 4px; overflow-x: auto; }
                code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 14px; }
                h1 { font-size: 24px; margin-bottom: 16px; }
                h2 { font-size: 20px; margin-bottom: 12px; }
                h3 { font-size: 18px; margin-bottom: 10px; }
                p { margin-bottom: 12px; line-height: 1.6; }
                ul, ol { margin-bottom: 12px; }
                li { margin-bottom: 6px; }
              </style>
            </head>
            <body>
              <div>${content.replace(/\n/g, '<br>')}</div>
            </body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
      toast.success('Opening print dialog for PDF export');
    }
  };

  if (!repo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden h-full">
        <div
          className={cn(
            "border-r bg-slate-100 flex flex-col transition-all duration-300 relative",
            sidebarCollapsed ? "w-12" : "w-64"
          )}
        >
          {/* Toggle Button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              "absolute top-2 z-10 p-1.5 hover:bg-slate-200 rounded-lg transition-colors",
              sidebarCollapsed ? "left-1/2 -translate-x-1/2" : "right-2"
            )}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft className="w-4 h-4 text-slate-600" />
          </button>

          {!sidebarCollapsed && (
            <>
              <div className="px-4 pt-2 flex-shrink-0">
                <button
                  onClick={() => router.push('/repos')}
                  className="flex items-center gap-2 h-7 mb-4 group"
                  title="Back to repositories"
                >
                  <GitBranch className="w-5 h-5 text-blue-600" />
                  <span className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Distill</span>
                </button>
                <div
                  className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-white border border-slate-200"
                  title={repo?.url}
                >
                  <FolderGit2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-800 truncate">{repo?.name}</span>
                </div>
                <Popover open={sidebarNewChatOpen} onOpenChange={setSidebarNewChatOpen}>
                  <PopoverTrigger asChild>
                    <button className="w-full flex items-center gap-2 px-3 py-2 mb-3 text-sm rounded-lg text-slate-700 hover:bg-slate-200 transition-colors">
                      <SquarePen className="w-4 h-4" />
                      New chat
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" side="right" align="start">
                    <Command>
                      <CommandInput placeholder="Search branches..." />
                      <CommandList>
                        <CommandEmpty>No branch found.</CommandEmpty>
                        <CommandGroup heading="Select branch for new chat">
                          {branches.map((b) => (
                            <CommandItem
                              key={b.branch}
                              value={b.branch}
                              onSelect={(branch) => handleNewChat(branch)}
                            >
                              <GitBranch className="mr-2 h-4 w-4 text-slate-500" />
                              <span className="truncate">{b.branch}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <h3 className="font-semibold text-sm text-slate-700 mb-2">Chats</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="space-y-1">
                  {chats.map((chat) => (
                    <div
                      key={chat.id}
                      className={cn(
                        'relative group rounded-lg transition-colors',
                        activeChat?.id === chat.id
                          ? 'bg-blue-100'
                          : 'hover:bg-slate-200'
                      )}
                    >
                      <button
                        onClick={() => handleSelectChat(chat)}
                        className={cn(
                          'w-full text-left px-3 py-2 text-sm',
                          activeChat?.id === chat.id
                            ? 'text-blue-900'
                            : 'text-slate-700'
                        )}
                      >
                        <div className="font-medium truncate pr-6">
                          {chat.type === 'COMPARE'
                            ? `${chat.leftBranch} ↔ ${chat.rightBranch}`
                            : (chat.branch ? `${chat.branch} branch` : (chat.title || 'Untitled'))}
                        </div>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:bg-slate-300 rounded transition-opacity"
                            title="Options"
                          >
                            <MoreVertical className="w-4 h-4 text-slate-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteChat(chat.id, e)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 border-t border-slate-200 p-2">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              </div>
            </>
          )}

          {sidebarCollapsed && (
            <>
              <div className="flex-1 flex flex-col items-center pt-16">
                <Popover open={sidebarNewChatOpen} onOpenChange={setSidebarNewChatOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="p-1.5 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                      title="New chat"
                    >
                      <SquarePen className="w-4 h-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" side="right" align="start">
                    <Command>
                      <CommandInput placeholder="Search branches..." />
                      <CommandList>
                        <CommandEmpty>No branch found.</CommandEmpty>
                        <CommandGroup heading="Select branch for new chat">
                          {branches.map((b) => (
                            <CommandItem
                              key={b.branch}
                              value={b.branch}
                              onSelect={(branch) => handleNewChat(branch)}
                            >
                              <GitBranch className="mr-2 h-4 w-4 text-slate-500" />
                              <span className="truncate">{b.branch}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-shrink-0 border-t border-slate-200 py-2 flex justify-center">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="p-1.5 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeChat ? (
              <>
                <div className="flex-1 relative overflow-hidden bg-white">
                  <div
                    ref={scrollViewportRef}
                    onScroll={handleScroll}
                    className="h-full overflow-y-auto"
                  >
                    <div className="max-w-6xl mx-auto space-y-6 p-6">
                      {/* Context injection indicator */}
                      <div className="flex justify-center gap-2 flex-wrap">
                        <div className={cn(
                          "px-4 py-2 rounded-full text-xs font-medium",
                          activeChat.includeContext
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        )}>
                          {activeChat.includeContext
                            ? "📚 Repository context injected"
                            : "Basic mode - Context not injected"}
                        </div>
                        {activeChat.personaName && (
                          <div className="px-4 py-2 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                            🎭 {activeChat.personaName}
                          </div>
                        )}
                        {activeDatasource && (
                          <button
                            onClick={() => chatDatasources.length > 1 && setDbPickerOpen(true)}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200",
                              chatDatasources.length > 1 ? "cursor-pointer hover:bg-emerald-100" : "cursor-default"
                            )}
                          >
                            🗄 {activeDatasource.name}
                          </button>
                        )}
                      </div>

                      {messages.reduce<{ lastModel: string | null; elements: React.ReactNode[] }>(
                        (acc, msg, index) => {
                          // Persona switch pill
                          if (msg.role === 'persona-switch') {
                            acc.elements.push(
                              <div key={`persona-switch-${msg.id}`} className="flex justify-center">
                                <div className="px-4 py-2 rounded-full text-xs font-medium bg-violet-50 text-violet-600 border border-violet-200">
                                  🎭 Switched to {msg.content}
                                </div>
                              </div>
                            );
                            return acc;
                          }
                          // Datasource switch pill
                          if (msg.role === 'datasource-switch') {
                            acc.elements.push(
                              <div key={`ds-switch-${msg.id}`} className="flex justify-center">
                                <div className="px-4 py-1 rounded-full text-xs bg-emerald-50 text-emerald-600 border border-emerald-200">
                                  🗄 Switched to {msg.content}
                                </div>
                              </div>
                            );
                            return acc;
                          }
                          // Immediate model-switch pill (appended when the user changes the model)
                          if (msg.role === 'model-switch') {
                            acc.elements.push(
                              <div key={`model-switch-${msg.id}`} className="flex justify-center">
                                <div className="px-4 py-2 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                  🤖 Switched to {msg.content}
                                </div>
                              </div>
                            );
                            if (msg.model) acc.lastModel = msg.model;
                            return acc;
                          }
                          // Insert a model-switch pill before an assistant message if model changed
                          if (msg.role === 'assistant' && !msg.error && msg.model && msg.model !== acc.lastModel && acc.lastModel !== null) {
                            acc.elements.push(
                              <div key={`model-switch-${msg.id}`} className="flex justify-center">
                                <div className="px-4 py-2 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                  🤖 Switched to {modelDisplayName(msg.provider, msg.model)}
                                </div>
                              </div>
                            );
                          }
                          if (msg.role === 'assistant' && msg.model) {
                            acc.lastModel = msg.model;
                          }
                          acc.elements.push(
                            <div
                              key={msg.id}
                              data-message-role={msg.role}
                              className={cn(
                                'flex gap-4',
                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                              )}
                            >
                              <Card
                                className={cn(
                                  'overflow-hidden rounded-2xl',
                                  msg.role === 'user' ? 'bg-blue-50 border border-blue-100 text-slate-800 w-auto max-w-[80%]' : msg.error ? 'bg-red-50 border-red-200 w-full' : 'bg-transparent border-0 shadow-none w-full'
                                )}
                              >
                                <CardContent className="p-4">
                                  {msg.role === 'user' ? (
                                    (() => {
                                      if (msg.content.startsWith('> ') && msg.content.includes('\n\n')) {
                                        const sep = msg.content.indexOf('\n\n');
                                        const quotePart = msg.content.slice(2, sep);
                                        const bodyPart = msg.content.slice(sep + 2);
                                        return (
                                          <div className="text-sm space-y-2">
                                            <div className="flex items-start gap-2">
                                              <div className="w-0.5 self-stretch bg-blue-300 rounded-full flex-shrink-0" />
                                              <span className="italic text-xs leading-relaxed line-clamp-2 text-slate-500">{quotePart}</span>
                                            </div>
                                            <UserMessageContent content={bodyPart} />
                                          </div>
                                        );
                                      }
                                      return <div className="text-sm"><UserMessageContent content={msg.content} /></div>;
                                    })()
                                  ) : msg.error ? (
                                    <div className="text-sm text-red-700 flex items-start gap-2">
                                      <span>{msg.content}</span>
                                    </div>
                                  ) : (
                                    <MarkdownMessage
                                      content={msg.content}
                                      className="text-sm"
                                      onFilePathClick={highlightAndOpenFile}
                                      activeDatasourceId={activeDatasource?.id}
                                      canExecute={activeDatasource?.canExecute ?? false}
                                      onQueryResult={setQueryResultOpen}
                                    />
                                  )}
                                </CardContent>

                                {/* Toolbar for assistant messages */}
                                {msg.role === 'assistant' && !msg.error && (
                                  <div className="px-1 py-1 flex justify-between items-center">
                                    <button
                                      onClick={() => openNewChatModal(index)}
                                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded transition-colors"
                                    >
                                      <MessageSquarePlus className="w-3.5 h-3.5" />
                                      Start a new chat
                                    </button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button className="p-1.5 hover:bg-slate-200 rounded transition-colors" title="Export">
                                          <Download className="w-4 h-4 text-slate-600" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => exportMessage(msg.content, 'md')}>
                                          Export as Markdown
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => exportMessage(msg.content, 'pdf')}>
                                          Export as PDF
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => exportMessage(msg.content, 'txt')}>
                                          Export as Text
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                )}
                              </Card>
                            </div>
                          );
                          return acc;
                        },
                        { lastModel: null, elements: [] }
                      ).elements}
                      <div ref={scrollSpacerRef} />
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {showScrollButtons && (
                    <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="rounded-full shadow-lg"
                        onClick={handleScrollToTop}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="rounded-full shadow-lg"
                        onClick={handleScrollToBottom}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="bg-white px-4 pb-4 pt-1 flex-shrink-0">
                  <div className="max-w-6xl mx-auto relative">
                    {/* Command suggestions */}
                    {showCommandSuggestions && filteredCommands.length > 0 && (
                      <div className="absolute bottom-full mb-2 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-10">
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                          <p className="text-xs font-semibold text-slate-700">Available Commands</p>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {filteredCommands.map((cmd, idx) => (
                            <button
                              key={cmd.command}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setInput(cmd.command);
                                setShowCommandSuggestions(false);
                                inputRef.current?.focus();
                              }}
                              disabled={!cmd.enabled}
                              className={cn(
                                "w-full text-left px-3 py-2 transition-colors",
                                idx === commandSelectedIndex ? "bg-slate-100" : "hover:bg-slate-50",
                                !cmd.enabled && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div className="font-mono text-sm text-blue-600">{cmd.command}</div>
                              <div className="text-xs text-slate-600 mt-0.5">{cmd.description}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSendMessage} className="relative">
                      {quotedText && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 z-10 flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                          <div className="w-0.5 self-stretch bg-blue-500 rounded-full flex-shrink-0" />
                          <span className="text-xs text-slate-500 font-medium flex-shrink-0">Replying to:</span>
                          <span className="flex-1 text-xs text-slate-700 truncate">{quotedText}</span>
                          <button
                            type="button"
                            onClick={() => setQuotedText(null)}
                            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="flex flex-col gap-1 rounded-3xl border border-slate-300 bg-white shadow-md px-3 py-2 focus-within:border-slate-400 transition-colors">
                        <Textarea
                          ref={inputRef}
                          rows={1}
                          value={input}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInput(val);
                            const show = val.startsWith('/');
                            setShowCommandSuggestions(show);
                            if (show) setCommandSelectedIndex(0);
                          }}
                          onKeyDown={(e) => {
                            if (showCommandSuggestions) {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setCommandSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setCommandSelectedIndex((i) => Math.max(i - 1, 0));
                              } else if (e.key === 'Enter') {
                                const cmd = filteredCommands[commandSelectedIndex];
                                if (cmd) {
                                  e.preventDefault();
                                  setInput(cmd.command);
                                  setShowCommandSuggestions(false);
                                }
                              } else if (e.key === 'Escape') {
                                setShowCommandSuggestions(false);
                              }
                              return;
                            }
                            // Enter sends, Shift+Enter inserts a newline
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage(e as unknown as React.FormEvent);
                            }
                          }}
                          onBlur={() => setTimeout(() => setShowCommandSuggestions(false), 200)}
                          placeholder="Ask about the code... (type / for commands · Enter to send, Shift+Enter for new line)"
                          disabled={streaming}
                          className="w-full border-0 shadow-none bg-transparent resize-none min-h-0 max-h-[160px] overflow-y-auto px-1 py-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <div className="flex justify-end">
                          {streaming ? (
                            <button
                              type="button"
                              onClick={handleStop}
                              title="Stop generating"
                              className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-700 text-white flex items-center justify-center transition-colors"
                            >
                              <Square className="w-3.5 h-3.5 fill-current" />
                            </button>
                          ) : (
                            <button
                              type="submit"
                              disabled={!input.trim()}
                              title="Send"
                              className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <GitBranch className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium mb-2">No chat selected</p>
                  <p className="text-sm mb-4">Create a new chat to start talking with your code</p>
                  <Popover open={newChatSelectorOpen} onOpenChange={setNewChatSelectorOpen}>
                    <PopoverTrigger asChild>
                      <Button size="sm">
                        <SquarePen className="w-4 h-4 mr-2" />
                        New Chat
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0">
                      <Command>
                        <CommandInput placeholder="Search branches..." />
                        <CommandList>
                          <CommandEmpty>No branch found.</CommandEmpty>
                          <CommandGroup heading="Select branch for new chat">
                            {branches.map((b) => (
                              <CommandItem
                                key={b.branch}
                                value={b.branch}
                                onSelect={(branch) => handleNewChat(branch)}
                              >
                                <GitBranch className="mr-2 h-4 w-4 text-slate-500" />
                                <span className="truncate">{b.branch}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {!selectedBranch && (
                    <p className="text-xs text-slate-400 mt-2">Select a branch first</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* File Explorer Panel */}
          {activeChat && (
            <div
              className={cn(
                "border-l bg-white transition-all duration-300 flex flex-col",
                fileExplorerOpen ? "w-80" : "w-12"
              )}
            >
              <div className="border-b p-2 flex items-center justify-between flex-shrink-0">
                {fileExplorerOpen ? (
                  <>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setRightPanelTab('files')}
                        className={cn(
                          'px-2 py-1 text-xs font-medium rounded transition-colors',
                          rightPanelTab === 'files'
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-500 hover:text-slate-700'
                        )}
                      >
                        Files
                      </button>
                      <button
                        onClick={() => setRightPanelTab('structure')}
                        className={cn(
                          'px-2 py-1 text-xs font-medium rounded transition-colors',
                          rightPanelTab === 'structure'
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-500 hover:text-slate-700'
                        )}
                      >
                        Structure
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      {rightPanelTab === 'files' && (
                        <>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="p-1 hover:bg-slate-100 rounded" title="Context info">
                                <Info className="w-4 h-4 text-slate-500" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent side="left" className="w-72">
                              <div className="space-y-2 text-xs">
                                <div>
                                  <span className="font-semibold">Chat created:</span>{' '}
                                  {new Date(activeChat.createdAt).toLocaleString()}
                                </div>
                                {repo?.contextUpdatedAt && (
                                  <div>
                                    <span className="font-semibold">Latest context:</span>{' '}
                                    {new Date(repo.contextUpdatedAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                          <button
                            onClick={() => setExpandedFolders(new Set())}
                            className="p-1 hover:bg-slate-100 rounded"
                            title="Collapse all folders"
                          >
                            <FoldVertical className="w-4 h-4 text-slate-600" />
                          </button>
                        </>
                      )}
                      {rightPanelTab === 'structure' && (
                        <>
                          {user?.isAdmin && (
                            <button
                              onClick={() => handleScanStructure(true)}
                              disabled={structureScanning}
                              className="p-1 hover:bg-orange-100 rounded"
                              title="Force rescan (re-runs AI review)"
                            >
                              <RefreshCw className={cn('w-4 h-4 text-orange-500', structureScanning && 'animate-spin')} />
                            </button>
                          )}
                          <button
                            onClick={() => handleScanStructure(false)}
                            disabled={structureScanning}
                            className="p-1 hover:bg-slate-100 rounded"
                            title="Rescan structure"
                          >
                            <RefreshCw className={cn('w-4 h-4 text-slate-600', structureScanning && 'animate-spin')} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setFileExplorerOpenPersisted(false)}
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 mx-auto">
                    <button
                      onClick={() => setFileExplorerOpenPersisted(true)}
                      className="p-1 hover:bg-slate-100 rounded"
                      title="Open file explorer"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="p-1 hover:bg-slate-100 rounded" title="Context info">
                          <Info className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="left" className="w-72">
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="font-semibold">Chat created:</span>{' '}
                            {new Date(activeChat.createdAt).toLocaleString()}
                          </div>
                          {repo?.contextUpdatedAt && (
                            <div>
                              <span className="font-semibold">Latest context:</span>{' '}
                              {new Date(repo.contextUpdatedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              {fileExplorerOpen && rightPanelTab === 'files' && (
                <>
                  <div className="flex-1 overflow-y-auto p-2">
                    {repoFiles.length > 0 ? (
                      renderFileTree(buildFileTree(repoFiles))
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">No files found</p>
                    )}
                  </div>
                  <div className="border-t p-2 flex-shrink-0">
                    <button
                      onClick={() => router.push(`/repos/${id}/docs`)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                    >
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      Docs
                    </button>
                  </div>
                </>
              )}

              {fileExplorerOpen && rightPanelTab === 'structure' && (
                <div className="flex-1 overflow-y-auto p-2">
                  {structures.length === 0 ? (
                    <div className="text-center py-6 px-3">
                      <Network className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 mb-3">No structure data yet.</p>
                      <p className="text-xs text-slate-400 mb-3">Add a <code className="bg-slate-100 px-1 rounded">structure</code> section to <code className="bg-slate-100 px-1 rounded">.distill.yaml</code> and click the rescan button.</p>
                      <button
                        onClick={() => handleScanStructure(false)}
                        disabled={structureScanning}
                        className="flex items-center gap-1.5 mx-auto px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                      >
                        <RefreshCw className={cn('w-3 h-3', structureScanning && 'animate-spin')} />
                        {structureScanning ? 'Scanning...' : 'Scan now'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {structures.map((s) => {
                        const data = JSON.parse(s.data);
                        const expanded = expandedStructures.has(s.id);
                        if (s.type === 'routing') {
                          return (
                            <div key={s.id}>
                              <div className="flex items-center">
                                <button
                                  onClick={() => toggleStructureSection(s.id)}
                                  className="flex-1 flex items-center gap-1.5 px-1 py-1 hover:bg-slate-50 rounded transition-colors min-w-0"
                                >
                                  <Route className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                  <span className="text-xs font-semibold text-slate-700">Routes</span>
                                  <span className="text-xs text-slate-400 truncate flex-1 text-left">({s.source})</span>
                                  <ChevronRight className={cn('w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform', expanded && 'rotate-90')} />
                                </button>
                                <div className="p-1 flex-shrink-0"><span className="block w-3 h-3" /></div>
                              </div>
                              {expanded && (data.routes?.length > 0 ? (
                                <div className="space-y-0.5 mt-0.5">
                                  {data.routes.map((r: { path: string; file: string; description?: string }) => (
                                    <div key={r.path} className="px-2 py-1 hover:bg-slate-50 rounded">
                                      <span className="font-mono text-xs text-slate-700">{r.path}</span>
                                      {r.description && (
                                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{r.description}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : data.content ? (
                                <pre className="text-xs text-slate-600 bg-slate-50 rounded p-2 overflow-x-auto whitespace-pre-wrap">{data.content.slice(0, 500)}{data.content.length > 500 ? '…' : ''}</pre>
                              ) : (
                                <p className="text-xs text-slate-400 px-2">No routes found</p>
                              ))}
                            </div>
                          );
                        }
                        if (s.type === 'schema') {
                          return (
                            <div key={s.id}>
                              <div className="flex items-center group">
                                <button
                                  onClick={() => toggleStructureSection(s.id)}
                                  className="flex-1 flex items-center gap-1.5 px-1 py-1 hover:bg-slate-50 rounded-l transition-colors min-w-0"
                                >
                                  <Database className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                                  <span className="text-xs font-semibold text-slate-700">Schema</span>
                                  <span className="text-xs text-slate-400 truncate flex-1 text-left">({s.source.split('/').pop()})</span>
                                  <ChevronRight className={cn('w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform', expanded && 'rotate-90')} />
                                </button>
                                <button
                                  onClick={() => window.open(`/repos/${id}/schema`, '_blank')}
                                  className="p-1 hover:bg-slate-50 rounded-r flex-shrink-0"
                                  title="Open schema viewer"
                                >
                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                </button>
                              </div>
                              {expanded && data.type === 'prisma' && data.models?.map((m: any) => (
                                <details key={m.name} className="group mb-1">
                                  <summary className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-xs font-medium text-slate-700">
                                    <span className="text-purple-600">{m.name}</span>
                                    <span className="text-slate-400 font-normal ml-auto">{m.fields.length} fields</span>
                                  </summary>
                                  <div className="pl-4 space-y-0.5 mt-0.5">
                                    {m.fields.map((f: any) => (
                                      <div key={f.name} className="flex items-center gap-1.5 px-2 py-0.5 text-xs">
                                        <span className="text-slate-700">{f.name}</span>
                                        <span className="text-slate-400">{f.type}{f.optional ? '?' : ''}{f.isList ? '[]' : ''}</span>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              ))}
                              {expanded && data.type === 'sql' && data.tables?.map((t: any) => (
                                <details key={t.name} className="group mb-1">
                                  <summary className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-xs font-medium text-slate-700">
                                    <span className="text-purple-600">{t.name}</span>
                                    <span className="text-slate-400 font-normal ml-auto">{t.columns.length} cols</span>
                                  </summary>
                                  <div className="pl-4 space-y-0.5 mt-0.5">
                                    {t.columns.map((col: string, i: number) => (
                                      <div key={i} className="px-2 py-0.5 text-xs text-slate-600 font-mono truncate">{col}</div>
                                    ))}
                                  </div>
                                </details>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              )}

              {!fileExplorerOpen && (
                <div className="flex flex-col items-center gap-2 py-2">
                  <button
                    onClick={() => { setFileExplorerOpenPersisted(true); setRightPanelTab('files'); }}
                    className="p-1 hover:bg-slate-100 rounded"
                    title="Files"
                  >
                    <Folder className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => { setFileExplorerOpenPersisted(true); setRightPanelTab('structure'); }}
                    className="p-1 hover:bg-slate-100 rounded"
                    title="Structure"
                  >
                    <Network className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => router.push(`/repos/${id}/docs`)}
                    className="p-1 hover:bg-slate-100 rounded"
                    title="Docs"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* File Viewer Dialog */}
        <Dialog open={!!viewingFile} onOpenChange={(open) => !open && setViewingFile(null)}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{viewingFile?.path}</DialogTitle>
              <DialogDescription>{selectedBranch}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <pre className="p-4 bg-slate-50 rounded text-sm font-mono overflow-x-auto">
                {viewingFile?.content}
              </pre>
            </div>
          </DialogContent>
        </Dialog>

        {/* Settings Modal */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>Configure options for {repo?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-medium text-slate-900">Auto Inject Context</p>
                  <p className="text-xs text-slate-500 mt-0.5">Automatically include repository docs in new chats</p>
                </div>
                <Switch
                  id="settings-auto-context"
                  checked={autoIncludeContext}
                  onCheckedChange={setAutoIncludeContext}
                  className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-slate-200"
                />
              </div>
              <hr className="border-slate-200" />
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-6">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Persona</p>
                    <p className="text-xs text-slate-500 mt-0.5">Shape how the AI communicates in new chats</p>
                  </div>
                  <Switch
                    checked={autoInjectPersona}
                    onCheckedChange={setAutoInjectPersonaPersisted}
                    className="data-[state=checked]:bg-violet-500 data-[state=unchecked]:bg-slate-200"
                  />
                </div>
                {autoInjectPersona && (
                  <Select value={selectedPersonaId} onValueChange={setSelectedPersonaIdPersisted}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={personas.length === 0 ? 'No personas configured' : 'Select persona'} />
                    </SelectTrigger>
                    {personas.length > 0 && (
                      <SelectContent>
                        {personas.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    )}
                  </Select>
                )}
              </div>
              <hr className="border-slate-200" />
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">Model</p>
                  <p className="text-xs text-slate-500 mt-0.5">Provider and model used for this chat</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={model} onValueChange={handleModelChange} disabled={modelsLoading}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={modelsLoading ? 'Loading…' : undefined} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <hr className="border-slate-200" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">Sync Repository</p>
                  <p className="text-xs text-slate-500 mt-0.5">Pull latest changes from remote</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => { await handlePull(); setSettingsOpen(false); }}
                  disabled={loading}
                >
                  <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
                  {loading ? 'Pulling…' : 'Pull'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Persona Picker Modal */}
        <Dialog open={personaPickerOpen} onOpenChange={setPersonaPickerOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Switch Persona</DialogTitle>
              <DialogDescription>Choose how the AI communicates for the rest of this chat</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-2">
              {personas.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => handlePersonaSwitch(persona)}
                  className={cn(
                    'border rounded-lg p-4 text-left flex flex-col gap-2 transition-colors hover:border-violet-400 hover:bg-violet-50',
                    activeChat?.personaName === persona.name
                      ? 'border-violet-400 bg-violet-50'
                      : 'border-slate-200 bg-white'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">{persona.name}</span>
                    {activeChat?.personaName === persona.name && (
                      <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{persona.description}</p>
                  <div className="flex justify-center mt-1">
                    <PersonaRadarChart persona={persona} size={220} color="#7c3aed" />
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* DB Picker Modal */}
        <Dialog open={dbPickerOpen} onOpenChange={setDbPickerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Switch Datasource</DialogTitle>
              <DialogDescription>Choose which database to use for this chat</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 py-2">
              {chatDatasources.map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => handleDatasourceSwitch(ds)}
                  className={cn(
                    'border rounded-lg p-4 text-left flex items-center gap-3 transition-colors hover:border-emerald-400 hover:bg-emerald-50',
                    activeDatasource?.id === ds.id
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  )}
                >
                  <span className="text-2xl">🗄</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">{ds.name}</span>
                      {activeDatasource?.id === ds.id && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Active</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 capitalize">{ds.type}</span>
                  </div>
                  {ds.canExecute && (
                    <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Can run queries</span>
                  )}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Query Result Modal */}
        <QueryResultModal
          result={queryResultOpen}
          onClose={() => setQueryResultOpen(null)}
          onCopyToChat={(text) =>
            setInput((prev) => (prev ? `${prev}\n\n${text}` : text))
          }
        />

        {/* New Chat Modal */}
        <Dialog open={newChatModalOpen} onOpenChange={setNewChatModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Start a New Chat</DialogTitle>
              <DialogDescription>
                Select branch and AI model for your new chat session
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Branch</label>
                <Select value={newChatBranch} onValueChange={setNewChatBranch}>
                  <SelectTrigger>
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

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <Label htmlFor="new-chat-context" className="font-medium">
                    Auto Inject Context
                  </Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Inject latest AI guidelines at chat start
                  </p>
                </div>
                <Switch
                  id="new-chat-context"
                  checked={newChatIncludeContext}
                  onCheckedChange={setNewChatIncludeContext}
                />
              </div>

              {personas.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Persona</label>
                  <Select
                    value={autoInjectPersona ? newChatPersonaId : 'none'}
                    onValueChange={(v) => {
                      if (v === 'none') {
                        setAutoInjectPersonaPersisted(false);
                      } else {
                        setAutoInjectPersonaPersisted(true);
                        setNewChatPersonaId(v);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No persona</SelectItem>
                      {personas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewChatModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createNewChatFromModal}>
                Create Chat
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Text selection popup — always in DOM, shown/hidden imperatively to avoid re-render side-effects */}
        <div
          ref={popupRef}
          className="fixed z-50 pointer-events-auto flex-col items-center"
          style={{ display: 'none', transform: 'translate(-50%, calc(-100% - 10px))' }}
        >
          <div className="flex items-center bg-slate-900 text-white rounded-lg shadow-xl overflow-hidden">
            <button
              onClick={handleQuoteInReply}
              className="flex items-center gap-1.5 px-3 py-2 text-xs hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              Quote in reply
            </button>
            <div className="w-px h-4 bg-slate-600" />
            <button
              onClick={() => {
                navigator.clipboard.writeText(selectedTextRef.current);
                toast.success('Copied');
                if (popupRef.current) popupRef.current.style.display = 'none';
                selectedTextRef.current = '';
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs hover:bg-slate-700 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          </div>
          <div className="flex justify-center">
            <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-900" />
          </div>
        </div>
      </div>
    </div>
  );
}
