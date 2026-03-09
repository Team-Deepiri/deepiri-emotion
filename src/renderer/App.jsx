import React, { useState, useEffect, useCallback, useRef } from 'react';
import CodeEditor from './components/CodeEditor';
import FileExplorer from './components/FileExplorer';
import ChallengePanel from './components/ChallengePanel';
import GamificationWidget from './components/GamificationWidget';
import TaskManager from './components/TaskManager';
import AIAssistant from './components/AIAssistant';
import Settings from './components/Settings';
import ApiModelsPage from './components/ApiModelsPage';
import IntegrationPanel from './components/IntegrationPanel';
import MissionCard from './components/MissionCard';
import CyrexEmbed from './components/CyrexEmbed';
import PipelinesView from './components/PipelinesView';
import MonacoEditor from './components/editor/MonacoEditor';
import EditorTabs from './components/editor/EditorTabs';
import WorkspaceFileExplorer from './components/workspace/WorkspaceFileExplorer';
import WorkspaceHeader from './components/workspace/WorkspaceHeader';
import WorkspaceView from './components/workspace/WorkspaceView';
import CommandPalette from './components/CommandPalette';
import GoToSymbolModal from './components/GoToSymbolModal';
import StatusBar from './components/StatusBar';
import TerminalPanel from './components/panels/TerminalPanel';
import OutputPanel from './components/panels/OutputPanel';
import ProblemsPanel from './components/panels/ProblemsPanel';
import SearchPanel from './components/panels/SearchPanel';
import OutlinePanel from './components/panels/OutlinePanel';
import KeybindingsPanel from './components/panels/KeybindingsPanel';
import ExtensionsPanel from './components/panels/ExtensionsPanel';
import FineTuningPanel from './components/panels/FineTuningPanel';
import ToolsPanel from './components/panels/ToolsPanel';
import ClassificationPanel from './components/panels/ClassificationPanel';
import DebugConsolePanel from './components/panels/DebugConsolePanel';
import PortsPanel from './components/panels/PortsPanel';
import MenuBar from './components/MenuBar';
import WelcomeScreen from './components/WelcomeScreen';
import QuickOpen from './features/quick-open/QuickOpen';
import AIChatPanel from './features/ai-chat/AIChatPanel';
import DiffView from './features/generation/DiffView';
import { EmotionPanel, useEmotion } from './features/emotion';
import { VisualCanvas } from './features/visual-editor';
import CreateLauncher from './features/create-launcher/CreateLauncher';
import VoiceInput from './features/multimodal/VoiceInput';
import GuideView from './features/guide/GuideView';
import Breadcrumbs from './components/Breadcrumbs';
import Notifications from './components/Notifications';
import { ResizeHandleVertical, ResizeHandleHorizontal } from './components/ResizeHandle';
import { useSession } from './hooks/useSession';
import { useKeybindings } from './hooks/useKeybindings';
import { useTheme } from './context/ThemeContext';
import { getLanguage } from './utils/editorLanguage';
import { layoutService } from './services/layoutService';
import { STORAGE_KEYS } from './constants/storageKeys';
import { getJSON } from './utils/storage';
import { DEFAULT_TABS_SETTINGS } from './config';
import './services/aiService';
import './services/challengeService';
import './services/taskService';
import './integrations/github';
import './integrations/notion';
import { classifySelection } from './services/classificationService';
import { runOrPreview } from './services/runPreviewService';
import { runHooks, HOOK_NAMES } from './services/hooksRegistry';
import { registerBuiltinTools } from './services/toolsRegistry';

let tabIdCounter = 0;
function nextTabId() {
  return `tab-${++tabIdCounter}`;
}

const App = () => {
  const [activeFile, setActiveFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [_challenges, setChallenges] = useState([]);
  const [_activeChallenge, setActiveChallenge] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [currentView, setCurrentView] = useState('explorer');
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [activeMissions, setActiveMissions] = useState([]);
  const [projectRoot, setProjectRoot] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState('terminal');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(null);
  const [problems, setProblems] = useState([]);
  const [outputLogs, setOutputLogs] = useState([]);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [showDiffView, setShowDiffView] = useState(false);
  const [diffOriginal, setDiffOriginal] = useState('');
  const [diffSuggested, setDiffSuggested] = useState('');
  const [outlineSymbols, setOutlineSymbols] = useState([]);
  const [editorSelection, setEditorSelection] = useState(null);
  const [pendingGoToLine, setPendingGoToLine] = useState(null);
  const [focusSearchRequest, setFocusSearchRequest] = useState(0);
  const [goToLineOpen, setGoToLineOpen] = useState(false);
  const [goToLineValue, setGoToLineValue] = useState('');
  const [goToSymbolOpen, setGoToSymbolOpen] = useState(false);
  const [createLauncherOpen, setCreateLauncherOpen] = useState(false);
  const [initialAIPrompt, setInitialAIPrompt] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [sidebarWidth, setSidebarWidth] = useState(() => layoutService.getSidebarWidth());
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => layoutService.getPanelHeight());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => layoutService.getSidebarCollapsed());
  const [tabsSettings, setTabsSettings] = useState(() => {
    const s = getJSON(STORAGE_KEYS.SETTINGS);
    return s?.tabs && typeof s.tabs === 'object' ? { ...DEFAULT_TABS_SETTINGS, ...s.tabs } : DEFAULT_TABS_SETTINGS;
  });
  const [workspaceRefreshTrigger, setWorkspaceRefreshTrigger] = useState(0);
  const editorApiRef = useRef(null);
  const userId = getJSON(STORAGE_KEYS.USER_ID) || 'default_user';
  const { recordKeystroke, recordFileChange } = useSession(userId);
  const { monacoTheme, theme, setTheme, editorFontSize, zoomIn, zoomOut, zoomReset } = useTheme();
  const { activeProfile: activeEmotionProfile, setActiveAgentId: setEmotionAgentId } = useEmotion();
  const recentFolders = typeof window !== 'undefined' && window.recentService ? window.recentService.getRecentFolders() : [];
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    const folder = projectRoot ? projectRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop() : null;
    const file = activeTab?.name;
    if (file && folder) document.title = `${file} - ${folder} - Deepiri Emotion`;
    else if (folder) document.title = `${folder} - Deepiri Emotion`;
    else document.title = 'Deepiri Emotion';
  }, [activeTab?.name, projectRoot]);

  useEffect(() => {
    if (window.electronAPI?.getProjectRoot) {
      window.electronAPI.getProjectRoot().then((root) => root && setProjectRoot(root));
    }
  }, []);

  useEffect(() => {
    const unsubSettings = window.electronAPI?.onMenuSettings?.(() => setCurrentView('settings'));
    return () => unsubSettings?.();
  }, []);

  useEffect(() => {
    const unsubNewFile = window.electronAPI?.onMenuNewFile?.(() => handleNewFile());
    return () => unsubNewFile?.();
  }, [handleNewFile]);

  useEffect(() => {
    const unsubOpenFolder = window.electronAPI?.onMenuOpenFolder?.(() => handleOpenFolder());
    return () => unsubOpenFolder?.();
  }, [handleOpenFolder]);

  useEffect(() => {
    const unsubSave = window.electronAPI?.onMenuSave?.(() => saveActiveTab());
    return () => unsubSave?.();
  }, [saveActiveTab]);

  useEffect(() => {
    const unsubAbout = window.electronAPI?.onMenuAbout?.(() => setShowAbout(true));
    return () => unsubAbout?.();
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onCommandOutput || !window.electronAPI?.onCommandExit) return;
    const unsubOut = window.electronAPI.onCommandOutput(({ type, text }) => {
      setOutputLogs((prev) => [...prev.slice(-999), { type, text }]);
    });
    const unsubExit = window.electronAPI.onCommandExit(() => {
      setOutputLogs((prev) => [...prev, { type: 'system', text: '--- Command finished ---\n' }]);
    });
    return () => {
      unsubOut();
      unsubExit();
    };
  }, []);

  useEffect(() => {
    if (showAbout && window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then((v) => setAppVersion(v || '1.0.0'));
    }
  }, [showAbout]);

  useEffect(() => {
    const onSettingsSaved = () => {
      const s = getJSON(STORAGE_KEYS.SETTINGS);
      if (s?.tabs && typeof s.tabs === 'object') {
        setTabsSettings({ ...DEFAULT_TABS_SETTINGS, ...s.tabs });
      }
    };
    window.addEventListener('settings-saved', onSettingsSaved);
    return () => window.removeEventListener('settings-saved', onSettingsSaved);
  }, []);

  useEffect(() => {
    if (pendingGoToLine == null || !activeTabId) return;
    const t = setTimeout(() => {
      editorApiRef.current?.goToLine(pendingGoToLine);
      setPendingGoToLine(null);
    }, 200);
    return () => clearTimeout(t);
  }, [activeTabId, pendingGoToLine]);

  useEffect(() => {
    registerBuiltinTools();
  }, []);

  const _initializeApp = async () => {
    try {
      const userId = localStorage.getItem('user_id') || 'default_user';
      const session = await window.electronAPI.startSession(userId);
      setSessionId(session);
      
      loadFiles();
      loadChallenges();
    } catch (error) {
      console.error('Initialization error:', error);
    }
  };

  const loadFiles = async () => {
    try {
      const result = await window.electronAPI.getTasks();
      if (result.success && result.data) {
        const taskFiles = result.data.map(task => ({
          name: task.title,
          type: 'file',
          path: `/tasks/${task.id}`,
          content: task.description || '',
          task: task
        }));
        
        const defaultFiles = [
          {
            name: 'Projects',
            type: 'folder',
            path: '/projects',
            children: [
              { name: 'project1.js', type: 'file', path: '/projects/project1.js', content: '// Your code here' },
              { name: 'project2.py', type: 'file', path: '/projects/project2.py', content: '# Your code here' }
            ]
          },
          {
            name: 'Tasks',
            type: 'folder',
            path: '/tasks',
            children: taskFiles
          }
        ];
        setFiles(defaultFiles);
      } else {
        // Fallback to default files
        const defaultFiles = [
          {
            name: 'Projects',
            type: 'folder',
            path: '/projects',
            children: [
              { name: 'project1.js', type: 'file', path: '/projects/project1.js', content: '// Your code here' },
              { name: 'project2.py', type: 'file', path: '/projects/project2.py', content: '# Your code here' }
            ]
          },
          {
            name: 'Tasks',
            type: 'folder',
            path: '/tasks',
            children: []
          }
        ];
        setFiles(defaultFiles);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      const defaultFiles = [
        {
          name: 'Projects',
          type: 'folder',
          path: '/projects',
          children: [
            { name: 'project1.js', type: 'file', path: '/projects/project1.js', content: '// Your code here' },
            { name: 'project2.py', type: 'file', path: '/projects/project2.py', content: '# Your code here' }
          ]
        },
        {
          name: 'Tasks',
          type: 'folder',
          path: '/tasks',
          children: []
        }
      ];
      setFiles(defaultFiles);
    }
  };

  const loadChallenges = async () => {
    try {
      const result = await window.electronAPI.apiRequest({
        method: 'GET',
        endpoint: '/challenges'
      });
      if (result.success) {
        setChallenges(result.data);
      }
    } catch (error) {
      console.error('Error loading challenges:', error);
    }
  };

  const handleFileSelect = async (file) => {
    if (file.type === 'file') {
      let content = file.content || '';
      
      // If file has a path, try to load it
      if (file.path && !content) {
        try {
          content = await window.electronAPI.openFile(file.path);
        } catch (error) {
          console.error('Error loading file:', error);
        }
      }
      
      setActiveFile({
        ...file,
        content: content
      });
      
      if (sessionId) {
        recordKeystroke('', file.path, 0, 0);
      }
    }
  };

  const handleChallengeStart = async (challenge) => {
    setActiveChallenge(challenge);
    if (window.missionSystem) {
      window.missionSystem.createMission(
        { id: challenge.id, title: challenge.title },
        'coding_sprint'
      );
    }
  };

  const handleCodeChange = (code) => {
    if (activeFile) {
      setActiveFile(prev => ({ ...prev, content: code }));
      recordFileChange(activeFile.path, 'edit', { code_length: code.length });
    }
  };

  const handleTaskSelect = (task) => {
    setActiveFile({
      name: task.title,
      path: `/tasks/${task.id}`,
      content: task.description || '',
      type: 'task'
    });
  };

  const handleCreateMission = async (task) => {
    try {
      const challenge = await window.challengeService.createChallengeFromTask(task);
      const mission = await window.challengeService.startChallenge(challenge);
      if (mission) {
        setActiveMissions(prev => [...prev, mission]);
      }
    } catch (error) {
      console.error('Mission creation error:', error);
    }
  };

  const handleMissionComplete = async (missionId) => {
    try {
      await window.challengeService.completeChallenge(missionId, { success: true });
      setActiveMissions(prev => prev.filter(m => m.id !== missionId));
    } catch (error) {
      console.error('Mission completion error:', error);
    }
  };

  const handleMissionAbandon = (missionId) => {
    setActiveMissions(prev => prev.filter(m => m.id !== missionId));
  };

  const switchView = (view) => {
    setCurrentView(view);
    document.querySelectorAll('.sidebar-content').forEach(el => el.classList.add('hidden'));
    const sidebarId = view === 'workspace' ? 'explorer-view' : `${view}-view`;
    const targetView = document.getElementById(sidebarId);
    if (targetView) {
      targetView.classList.remove('hidden');
    }
  };

  const handleOpenFolder = useCallback(async () => {
    try {
      const root = await window.electronAPI.openProject();
      setProjectRoot(root);
      if (root && window.recentService) window.recentService.addRecentFolder(root);
    } catch (e) {
      if (e.message !== 'Canceled') console.error(e);
    }
  }, []);

  const openFileInEditor = useCallback(async (entry) => {
    if (!entry || entry.isDirectory) return;
    const existing = openTabs.find((t) => t.path === entry.path);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    let content = '';
    try {
      content = await window.electronAPI.openFile(entry.path);
    } catch (e) {
      content = `// Error loading file: ${e.message}`;
    }
    const tab = {
      id: nextTabId(),
      path: entry.path,
      name: entry.name,
      content,
      dirty: false
    };
    setOpenTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    if (window.recentService) window.recentService.addRecentFile(entry.path, entry.name);
    runHooks(HOOK_NAMES.AFTER_OPEN, { path: entry.path, name: entry.name }).catch(() => {});
  }, [openTabs]);

  const updateTabContent = useCallback((tabId, content, dirty = true) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, content, dirty } : t))
    );
  }, []);

  const closeTab = useCallback((tabId) => {
    const tab = openTabs.find((t) => t.id === tabId);
    const confirmUnsaved = tabsSettings.confirmCloseUnsaved !== false;
    if (tab?.dirty && confirmUnsaved && !window.confirm('Close without saving?')) return;
    setOpenTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (activeTabId === tabId) {
      const rest = openTabs.filter((t) => t.id !== tabId);
      setActiveTabId(rest.length ? rest[rest.length - 1].id : null);
    }
  }, [openTabs, activeTabId, tabsSettings]);

  const saveActiveTab = useCallback(async () => {
    const tab = openTabs.find((t) => t.id === activeTabId);
    if (!tab?.path || tab.path.startsWith('/tasks/')) return;
    try {
      await runHooks(HOOK_NAMES.BEFORE_SAVE, { path: tab.path, content: tab.content });
      await window.electronAPI.saveFile({ path: tab.path, content: tab.content });
      setOpenTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, dirty: false } : t))
      );
      recordFileChange(tab.path, 'save', {});
      await runHooks(HOOK_NAMES.AFTER_SAVE, { path: tab.path });
    } catch (e) {
      console.error(e);
    }
  }, [openTabs, activeTabId, recordFileChange]);

  const handleNewFile = useCallback(async () => {
    if (!projectRoot) {
      handleOpenFolder();
      return;
    }
    const name = window.prompt('File name (e.g. src/App.js):');
    if (!name?.trim()) return;
    try {
      const path = projectRoot.replace(/\\/g, '/').replace(/\/$/, '') + '/' + name.trim();
      const dir = path.split('/').slice(0, -1).join('/');
      const fileName = path.split('/').pop();
      await window.electronAPI.createFile({ dirPath: dir, name: fileName });
      setWorkspaceRefreshTrigger((t) => t + 1);
      await openFileInEditor({ path, name: fileName });
    } catch (e) {
      console.error(e);
      if (window.toast || window.electronAPI?.showError) {
        (window.toast || window.electronAPI.showError)(e.message || 'Failed to create file');
      }
    }
  }, [projectRoot, openFileInEditor, handleOpenFolder]);

  const handleNewFolder = useCallback(async () => {
    if (!projectRoot || !window.electronAPI?.createFolder) return;
    const name = window.prompt('Folder name:');
    if (!name?.trim()) return;
    try {
      await window.electronAPI.createFolder({ dirPath: projectRoot, name: name.trim() });
      const r = await window.electronAPI?.getProjectRoot?.();
      if (r) setProjectRoot(r);
      setWorkspaceRefreshTrigger((t) => t + 1);
      if (window.toast) window.toast('Folder created.');
    } catch (e) {
      (window.toast || window.electronAPI?.showError)?.(e?.message || 'Failed to create folder');
    }
  }, [projectRoot]);

  const handleNewFileFromTemplate = useCallback(async (filename, content) => {
    if (!projectRoot || !window.electronAPI?.createFile) return;
    try {
      const sep = projectRoot.includes('\\') ? '\\' : '/';
      const path = `${projectRoot.replace(/[/\\]+$/, '')}${sep}${filename.replace(/^\//, '')}`;
      const parts = path.replace(/\\/g, '/').split('/');
      const name = parts.pop();
      const dirPath = parts.join(sep);
      await window.electronAPI.createFile({ dirPath, name });
      if (window.electronAPI.saveFile) await window.electronAPI.saveFile(path, content);
      setWorkspaceRefreshTrigger((t) => t + 1);
      await openFileInEditor({ path, name });
    } catch (e) {
      window.toast?.(e?.message || 'Failed to create file');
    }
  }, [projectRoot, openFileInEditor]);

  const handleSelectWorkspaceResult = useCallback(async ({ path, name, line }) => {
    const tab = openTabs.find((t) => t.path === path);
    if (tab) {
      setActiveTabId(tab.id);
      setTimeout(() => editorApiRef.current?.goToLine(line), 100);
    } else {
      setPendingGoToLine(line);
      await openFileInEditor({ path, name });
    }
  }, [openTabs, openFileInEditor]);

  useKeybindings([
    { key: 'p', ctrlKey: true, shiftKey: true, action: () => setCommandPaletteOpen(true) },
    { key: 'p', ctrlKey: true, action: (e) => { e.preventDefault(); setQuickOpenOpen(true); } },
    { key: 'n', ctrlKey: true, action: (e) => { e.preventDefault(); handleNewFile(); } },
    { key: 'n', ctrlKey: true, shiftKey: true, action: (e) => { e.preventDefault(); setCreateLauncherOpen(true); } },
    { key: 's', ctrlKey: true, action: (e) => { e.preventDefault(); saveActiveTab(); } },
    { key: 'o', ctrlKey: true, action: (e) => { e.preventDefault(); handleOpenFolder(); } },
    { key: 'b', ctrlKey: true, action: (e) => { e.preventDefault(); setSidebarCollapsed((c) => { const next = !c; layoutService.setSidebarCollapsed(next); return next; }); } },
    { key: 'j', ctrlKey: true, action: (e) => { e.preventDefault(); setBottomPanelOpen((o) => !o); } },
    { key: 'o', ctrlKey: true, shiftKey: true, action: (e) => { e.preventDefault(); if (activeTabId) setGoToSymbolOpen(true); } },
    { key: 'g', ctrlKey: true, action: (e) => { e.preventDefault(); setGoToLineOpen(true); setGoToLineValue(''); } },
    { key: 'f', ctrlKey: true, shiftKey: true, action: (e) => { e.preventDefault(); switchView('search'); setFocusSearchRequest((n) => n + 1); } },
    { key: 'f', ctrlKey: true, shiftKey: false, action: (e) => { e.preventDefault(); if (activeTabId) editorApiRef.current?.triggerFind(); } },
    { key: 'h', ctrlKey: true, action: (e) => { e.preventDefault(); if (activeTabId) editorApiRef.current?.triggerReplace(); } },
    { key: 'F', shiftKey: true, altKey: true, action: (e) => { e.preventDefault(); editorApiRef.current?.formatDocument(); } },
    { key: '=', ctrlKey: true, action: (e) => { e.preventDefault(); zoomIn(); } },
    { key: '-', ctrlKey: true, action: (e) => { e.preventDefault(); zoomOut(); } },
    { key: '0', ctrlKey: true, action: (e) => { e.preventDefault(); zoomReset(); } }
  ]);

  const handleCommand = useCallback((cmdId) => {
    if (cmdId === 'open-folder') handleOpenFolder();
    else if (cmdId === 'quick-open') setQuickOpenOpen(true);
    else if (cmdId === 'new-file') handleNewFile();
    else if (cmdId === 'save') saveActiveTab();
    else if (cmdId === 'toggle-sidebar') { setSidebarCollapsed((c) => { const next = !c; layoutService.setSidebarCollapsed(next); return next; }); }
    else if (cmdId === 'toggle-panel') setBottomPanelOpen((o) => !o);
    else if (cmdId === 'toggle-terminal') { setBottomPanelOpen(true); setBottomPanelTab('terminal'); }
    else if (cmdId === 'toggle-output') { setBottomPanelOpen(true); setBottomPanelTab('output'); }
    else if (cmdId === 'toggle-problems') { setBottomPanelOpen(true); setBottomPanelTab('problems'); }
    else if (cmdId === 'toggle-debug-console') { setBottomPanelOpen(true); setBottomPanelTab('debug-console'); }
    else if (cmdId === 'toggle-ports') { setBottomPanelOpen(true); setBottomPanelTab('ports'); }
    else if (cmdId === 'command-palette') setCommandPaletteOpen(true);
    else if (cmdId === 'about') setShowAbout(true);
    else if (cmdId === 'toggle-ai') setShowAIAssistant((v) => !v);
    else if (cmdId?.startsWith('use-agent-')) {
      const agentId = cmdId.replace(/^use-agent-/, '');
      setEmotionAgentId(agentId);
      setShowAIAssistant(true);
    }
    else if (cmdId === 'ask-ai-explain') {
      setInitialAIPrompt(editorSelection?.trim() ? 'Explain the selected code.' : 'Explain this file.');
      setShowAIAssistant(true);
      setTimeout(() => setInitialAIPrompt(null), 500);
    }
    else if (cmdId === 'ask-ai-refactor') {
      setInitialAIPrompt(editorSelection?.trim() ? 'Refactor the selected code for clarity and best practices.' : 'Refactor this file for clarity and best practices.');
      setShowAIAssistant(true);
      setTimeout(() => setInitialAIPrompt(null), 500);
    }
    else if (cmdId === 'ask-ai-add-tests') {
      setInitialAIPrompt(editorSelection?.trim() ? 'Add unit tests for the selected code.' : 'Add unit tests for this file.');
      setShowAIAssistant(true);
      setTimeout(() => setInitialAIPrompt(null), 500);
    }
    else if (cmdId === 'classify-selection') {
      const text = editorSelection?.trim() || openTabs.find((t) => t.id === activeTabId)?.content?.trim() || '';
      if (text) classifySelection(text).then((r) => { window.toast?.(`Classified: ${r.label} (${Math.round((r.confidence || 0) * 100)}%)`); }).catch(() => { window.toast?.('Classification failed'); });
      else window.toast?.('Select text or open a file to classify');
    }
    else if (cmdId === 'classify-and-ask-ai') {
      const text = editorSelection?.trim() || openTabs.find((t) => t.id === activeTabId)?.content?.trim() || '';
      if (text) {
        classifySelection(text).then((r) => {
          setInitialAIPrompt(`Classification: ${r.label}. Based on this, help me with the content.`);
          setShowAIAssistant(true);
          setTimeout(() => setInitialAIPrompt(null), 500);
        });
      } else window.toast?.('Select text first');
    }
    else if (cmdId === 'keybindings') switchView('keybindings');
    else if (cmdId === 'extensions') switchView('extensions');
    else if (cmdId === 'outline') switchView('outline');
    else if (cmdId === 'go-to-line') setGoToLineOpen(true);
    else if (cmdId === 'go-to-symbol') { if (activeTabId) setGoToSymbolOpen(true); }
    else if (cmdId === 'format-document') editorApiRef.current?.formatDocument();
    else if (cmdId === 'run-preview') {
      const tab = openTabs.find((t) => t.id === activeTabId);
      if (tab) {
        saveActiveTab().then(async () => {
          const r = await runOrPreview({ path: tab.path, content: tab.content, name: tab.name }, projectRoot);
          if (r.ok) { setBottomPanelOpen(true); setBottomPanelTab('terminal'); }
          window.toast?.(r.ok ? r.message : r.message);
        });
      } else window.toast?.('Open a file first');
    }
    else if (cmdId === 'find-in-file') editorApiRef.current?.triggerFind();
    else if (cmdId === 'replace-in-file') editorApiRef.current?.triggerReplace();
    else if (cmdId === 'focus-search') { switchView('search'); setFocusSearchRequest((n) => n + 1); }
    else if (cmdId === 'settings') switchView('settings');
    else if (cmdId === 'api-models') switchView('api-models');
    else if (cmdId === 'open-visual') switchView('visual');
    else if (cmdId === 'open-emotion') switchView('emotion');
    else if (cmdId === 'open-finetuning') { setBottomPanelOpen(true); setBottomPanelTab('finetuning'); }
    else if (cmdId === 'toggle-tools') { setBottomPanelOpen(true); setBottomPanelTab('tools'); }
    else if (cmdId === 'create-anything') setCreateLauncherOpen(true);
    else if (cmdId === 'open-guide') switchView('guide');
    else if (cmdId === 'new-task') {
      const title = window.prompt('Task title');
      if (title) window.taskService?.createTask(title).then(() => loadFiles());
    }
  }, [handleOpenFolder, handleNewFile, saveActiveTab, loadFiles, setEmotionAgentId]);

  const handleSidebarResize = useCallback((delta) => {
    setSidebarWidth((w) => layoutService.setSidebarWidth(w + delta));
  }, []);
  const handlePanelResize = useCallback((delta) => {
    setBottomPanelHeight((h) => layoutService.setPanelHeight(h - delta));
  }, []);

  const handleReplaceInOpenFiles = useCallback((results, replaceText, options) => {
    if (!results.length || !options?.query) return;
    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const q = escapeRe(options.query);
    const re = options.wholeWord
      ? new RegExp(`\\b${q}\\b`, options.caseSensitive ? 'g' : 'gi')
      : new RegExp(q, options.caseSensitive ? 'g' : 'gi');
    const safeReplace = replaceText.replace(/\$/g, '$$');
    const byTab = new Map();
    results.forEach((r) => {
      if (r.tabId != null) {
        if (!byTab.has(r.tabId)) byTab.set(r.tabId, true);
      }
    });
    byTab.forEach((_, tabId) => {
      const tab = openTabs.find((t) => t.id === tabId);
      if (!tab?.content) return;
      const newContent = tab.content.replace(re, safeReplace);
      if (newContent !== tab.content) updateTabContent(tabId, newContent);
    });
    window.toast?.('Replace all done.');
  }, [openTabs, updateTabContent]);

  const recentFiles = typeof window !== 'undefined' && window.recentService ? window.recentService.getRecentFiles() : [];

  return (
    <div className="ide-container">
      <MenuBar onCommand={handleCommand} />
      <div className="ide-main-row">
      <div className="activity-bar">
        <div 
          className={`activity-item ${currentView === 'explorer' ? 'active' : ''}`}
          onClick={() => switchView('explorer')}
          title="Explorer"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'workspace' ? 'active' : ''}`}
          onClick={() => switchView('workspace')}
          title="Workspace — view and add files"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            <line x1="12" y1="11" x2="12" y2="17"/>
            <line x1="9" y1="14" x2="15" y2="14"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'tasks' ? 'active' : ''}`}
          onClick={() => switchView('tasks')}
          title="Tasks"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'challenges' ? 'active' : ''}`}
          onClick={() => switchView('challenges')}
          title="Challenges"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'gamification' ? 'active' : ''}`}
          onClick={() => switchView('gamification')}
          title="Gamification"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'integrations' ? 'active' : ''}`}
          onClick={() => switchView('integrations')}
          title="Integrations"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'cyrex' ? 'active' : ''}`}
          onClick={() => switchView('cyrex')}
          title="Cyrex AI"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 010 2h-1a7 7 0 01-7 7h-1v1.27c.6.34 1 .99 1 1.73a2 2 0 01-2 2 2 2 0 01-2-2c0-.74.4-1.39 1-1.73V17h-1a7 7 0 01-7-7H4a1 1 0 010-2h1a7 7 0 017-7h1V5.27C9.4 4.93 9 4.28 9 3.54a2 2 0 012-2z"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'pipelines' ? 'active' : ''}`}
          onClick={() => switchView('pipelines')}
          title="Helox Pipelines"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M4 4h16v2H4zM4 10h16v2H4zM4 16h10v2H4z"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'emotion' ? 'active' : ''}`}
          onClick={() => switchView('emotion')}
          title="Emotion — deepiri-emotion"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'visual' ? 'active' : ''}`}
          onClick={() => switchView('visual')}
          title="Visual — No-code canvas"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'guide' ? 'active' : ''}`}
          onClick={() => switchView('guide')}
          title="Guide — What's new"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'search' ? 'active' : ''}`}
          onClick={() => switchView('search')}
          title="Search"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'outline' ? 'active' : ''}`}
          onClick={() => switchView('outline')}
          title="Outline"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'keybindings' ? 'active' : ''}`}
          onClick={() => switchView('keybindings')}
          title="Keyboard Shortcuts"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M4 6h16M4 10h16M4 14h16M4 18h16M2 6v12M22 6v12"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'extensions' ? 'active' : ''}`}
          onClick={() => switchView('extensions')}
          title="Extensions"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${currentView === 'api-models' ? 'active' : ''}`}
          onClick={() => switchView('api-models')}
          title="API & Model"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/>
          </svg>
        </div>
        <div 
          className={`activity-item ${showAIAssistant ? 'active' : ''}`}
          onClick={() => setShowAIAssistant(!showAIAssistant)}
          title="AI Chat"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </div>
      </div>

      <div
        className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
        id="sidebar"
        style={{
          width: sidebarCollapsed ? 0 : sidebarWidth,
          minWidth: sidebarCollapsed ? 0 : 120,
          maxWidth: sidebarCollapsed ? 0 : 600,
          overflow: sidebarCollapsed ? 'hidden' : undefined
        }}
      >
        <div className="sidebar-content" id="explorer-view">
          <WorkspaceHeader
            projectRoot={projectRoot}
            onOpenFolder={handleOpenFolder}
            onNewFile={handleNewFile}
            onNewFolder={handleNewFolder}
            onRefresh={() => window.electronAPI?.getProjectRoot().then((r) => r && setProjectRoot(r))}
          />
          {projectRoot ? (
            <WorkspaceFileExplorer
              projectRoot={projectRoot}
              selectedPath={activeTab?.path}
              onSelectFile={openFileInEditor}
              onRefresh={() => window.electronAPI?.getProjectRoot().then((r) => r && setProjectRoot(r))}
              refreshTrigger={workspaceRefreshTrigger}
            />
          ) : (
            <div className="workspace-no-tree">
              <FileExplorer files={files} onFileSelect={handleFileSelect} />
            </div>
          )}
        </div>

        <div className="sidebar-content hidden" id="challenges-view">
          <div className="sidebar-header">
            <span>CHALLENGES</span>
          </div>
          <ChallengePanel
            onChallengeStart={handleChallengeStart}
            onChallengeComplete={(_id) => {
              setActiveChallenge(null);
              loadChallenges();
            }}
          />
        </div>

        <div className="sidebar-content hidden" id="tasks-view">
          <div className="sidebar-header">
            <span>TASKS</span>
          </div>
          <TaskManager
            onTaskSelect={handleTaskSelect}
            onCreateMission={handleCreateMission}
          />
        </div>

        <div className="sidebar-content hidden" id="gamification-view">
          <div className="sidebar-header">
            <span>GAMIFICATION</span>
          </div>
          <GamificationWidget />
        </div>

        <div className="sidebar-content hidden" id="integrations-view">
          <div className="sidebar-header">
            <span>INTEGRATIONS</span>
          </div>
          <IntegrationPanel />
        </div>

        <div className="sidebar-content hidden" id="cyrex-view">
          <div className="sidebar-header">
            <span>CYREX AI</span>
          </div>
          <p className="sidebar-placeholder">
            Agent Playground, RAG, Workflows, and more load in the main area. Start the Cyrex interface on port 5175 for full UI.
          </p>
        </div>

        <div className="sidebar-content hidden" id="pipelines-view">
          <div className="sidebar-header">
            <span>PIPELINES</span>
          </div>
          <p className="sidebar-placeholder">
            Run and cancel from the main area. Select a pipeline and click Run.
          </p>
        </div>

        <div className="sidebar-content hidden" id="search-view">
          <div className="sidebar-header">
            <span>SEARCH</span>
          </div>
          <p className="sidebar-placeholder">
            Search in open files. Use the main area to run search.
          </p>
        </div>

        <div className="sidebar-content hidden" id="outline-view">
          <div className="sidebar-header">
            <span>OUTLINE</span>
          </div>
          <OutlinePanel
            symbols={outlineSymbols}
            onSelectSymbol={(sym) => editorApiRef.current?.goToLine(sym.range?.startLineNumber)}
          />
        </div>

        <div className="sidebar-content hidden" id="keybindings-view">
          <div className="sidebar-header">
            <span>KEYBOARD SHORTCUTS</span>
          </div>
          <KeybindingsPanel />
        </div>

        <div className="sidebar-content hidden" id="extensions-view">
          <div className="sidebar-header">
            <span>EXTENSIONS</span>
          </div>
          <ExtensionsPanel />
        </div>
        <div className="sidebar-content hidden" id="api-models-view">
          <div className="sidebar-header">
            <span>API &amp; MODEL</span>
          </div>
          <p className="sidebar-placeholder">Configure provider and model in the main area.</p>
        </div>
      </div>
      {!sidebarCollapsed && <ResizeHandleVertical onResize={handleSidebarResize} />}
      {sidebarCollapsed && (
        <div
          className="sidebar-expand-handle"
          onClick={() => { setSidebarCollapsed(false); layoutService.setSidebarCollapsed(false); }}
          title="Show sidebar (Ctrl+B)"
        />
      )}
        <div className="editor-area" style={{ minWidth: 0, flex: 1 }}>
        {openTabs.length > 0 && (
          <EditorTabs
            tabs={openTabs}
            activeId={activeTabId}
            onSelect={setActiveTabId}
            onClose={closeTab}
            showFullPathInTab={tabsSettings.showFullPathInTab}
            doubleClickToClose={tabsSettings.doubleClickToClose}
          />
        )}

        {activeTab && (
          <Breadcrumbs path={activeTab.path} name={activeTab.name} />
        )}

        <div className="editor-container">
          <div className="editor-main">
            {showDiffView ? (
              <DiffView
                original={diffOriginal}
                suggested={diffSuggested}
                fileName={activeTab?.name}
                onApply={(content) => {
                  if (activeTabId) updateTabContent(activeTabId, content);
                  setShowDiffView(false);
                }}
                onReject={() => setShowDiffView(false)}
              />
            ) :             currentView === 'workspace' ? (
              <WorkspaceView
                projectRoot={projectRoot}
                onOpenFolder={handleOpenFolder}
                onNewFile={handleNewFile}
                onNewFolder={handleNewFolder}
                onOpenFile={openFileInEditor}
                refreshTrigger={workspaceRefreshTrigger}
              />
            ) : currentView === 'cyrex' ? (
              <CyrexEmbed />
            ) : currentView === 'pipelines' ? (
              <PipelinesView />
            ) : currentView === 'guide' ? (
              <GuideView />
            ) : currentView === 'settings' ? (
              <Settings />
            ) : currentView === 'api-models' ? (
              <ApiModelsPage />
            ) : currentView === 'emotion' ? (
              <EmotionPanel onOpenAIChat={() => setShowAIAssistant(true)} />
            ) : currentView === 'visual' ? (
              <VisualCanvas
                onExportToFile={async (filename, content) => {
                  if (window.electronAPI?.createFile && projectRoot) {
                    try {
                      const sep = projectRoot.includes('\\') ? '\\' : '/';
                      const path = `${projectRoot}${sep}${filename}`;
                      await window.electronAPI.createFile({ dirPath: projectRoot, name: filename });
                      if (window.electronAPI.saveFile) await window.electronAPI.saveFile(path, content);
                      openFileInEditor({ path, name: filename });
                    } catch (e) {
                      navigator.clipboard?.writeText(content);
                      window.toast?.(e?.message || 'Copied to clipboard (save failed)');
                    }
                  } else {
                    navigator.clipboard?.writeText(content);
                    window.toast?.('Copied to clipboard');
                  }
                }}
              />
            ) : currentView === 'search' ? (
              <SearchPanel
                openTabs={openTabs}
                projectRoot={projectRoot}
                onSelectTab={(tabId, line) => {
                  setActiveTabId(tabId);
                  setTimeout(() => editorApiRef.current?.goToLine(line), 50);
                }}
                onSelectWorkspaceResult={handleSelectWorkspaceResult}
                onReplaceAll={handleReplaceInOpenFiles}
                focusRequest={focusSearchRequest}
              />
            ) : activeTab ? (
              <>
                <div className="editor-ai-bar">
                  <button
                    type="button"
                    className="editor-ask-ai-btn"
                    onClick={() => {
                      setInitialAIPrompt(editorSelection?.trim()
                        ? 'Explain the selected code and suggest improvements.'
                        : 'Explain this file and suggest improvements.');
                      setShowAIAssistant(true);
                      setTimeout(() => setInitialAIPrompt(null), 500);
                    }}
                    title="Ask AI about this file or selection"
                  >
                    ✨ Ask AI
                  </button>
                  <div className="editor-ai-chips">
                    <button type="button" className="editor-ai-chip" onClick={() => { setInitialAIPrompt(editorSelection?.trim() ? 'Explain the selected code.' : 'Explain this file.'); setShowAIAssistant(true); setTimeout(() => setInitialAIPrompt(null), 500); }} title="Explain">Explain</button>
                    <button type="button" className="editor-ai-chip" onClick={() => { setInitialAIPrompt(editorSelection?.trim() ? 'Refactor the selected code for clarity and best practices.' : 'Refactor this file for clarity and best practices.'); setShowAIAssistant(true); setTimeout(() => setInitialAIPrompt(null), 500); }} title="Refactor">Refactor</button>
                    <button type="button" className="editor-ai-chip" onClick={() => { setInitialAIPrompt(editorSelection?.trim() ? 'Add unit tests for the selected code.' : 'Add unit tests for this file.'); setShowAIAssistant(true); setTimeout(() => setInitialAIPrompt(null), 500); }} title="Add tests">Add tests</button>
                    <VoiceInput onTranscript={(t) => editorApiRef.current?.insertTextAtCursor(t)} disabled={!activeTabId} />
                    <button
                      type="button"
                      className="editor-ai-chip"
                      title="Run or preview (HTML in browser, Node/Python in terminal)"
                      onClick={async () => {
                        if (!activeTab) return;
                        await saveActiveTab();
                        const r = await runOrPreview({ path: activeTab.path, content: activeTab.content, name: activeTab.name }, projectRoot);
                        if (r.ok) { setBottomPanelOpen(true); setBottomPanelTab('terminal'); }
                        window.toast?.(r.ok ? r.message : r.message);
                      }}
                    >
                      Run
                    </button>
                    <button
                      type="button"
                      className="editor-ai-chip"
                      title="Classify selection (intent/domain)"
                      onClick={async () => {
                        const text = editorSelection?.trim() || activeTab?.content?.trim() || '';
                        if (!text) { window.toast?.('Select text or open a file to classify'); return; }
                        const r = await classifySelection(text);
                        window.toast?.(`Classified: ${r.label} (${Math.round((r.confidence || 0) * 100)}%)`);
                      }}
                    >
                      Classify
                    </button>
                    <button
                      type="button"
                      className="editor-ai-chip"
                      title="Classify selection then ask AI"
                      onClick={async () => {
                        const text = editorSelection?.trim() || activeTab?.content?.trim() || '';
                        if (!text) { window.toast?.('Select text first'); return; }
                        const r = await classifySelection(text);
                        setInitialAIPrompt(`Classification: ${r.label}. Based on this, help me with the selected content.`);
                        setShowAIAssistant(true);
                        setTimeout(() => setInitialAIPrompt(null), 500);
                      }}
                    >
                      Classify & Ask AI
                    </button>
                  </div>
                </div>
              <MonacoEditor
                path={activeTab.path}
                value={activeTab.content}
                onChange={(v) => updateTabContent(activeTab.id, v)}
                onSave={saveActiveTab}
                onCursorChange={setCursorPosition}
                onSelectionChange={setEditorSelection}
                onSymbolsChange={setOutlineSymbols}
                onEditorReady={(api) => { editorApiRef.current = api; }}
                onProblemsChange={setProblems}
                theme={monacoTheme}
                fontSize={editorFontSize}
                height="100%"
              />
              </>
            ) : activeFile ? (
              <CodeEditor
                content={activeFile.content || ''}
                language={getLanguageFromFile(activeFile.name)}
                onChange={handleCodeChange}
                onSave={async () => {
                  if (activeFile.path) {
                    try {
                      await window.electronAPI.saveFile(activeFile.path, activeFile.content || '');
                      recordFileChange(activeFile.path, 'save', {});
                    } catch (error) {
                      console.error('Error saving file:', error);
                    }
                  }
                }}
              />
            ) : (
              <WelcomeScreen
                onOpenFolder={handleOpenFolder}
                onNewFile={handleNewFile}
                onCommandPalette={() => setCommandPaletteOpen(true)}
                onQuickOpen={() => setQuickOpenOpen(true)}
                onOpenAIChat={() => setShowAIAssistant(true)}
                onOpenVisual={() => switchView('visual')}
                onOpenEmotion={() => switchView('emotion')}
                onOpenCreateLauncher={() => setCreateLauncherOpen(true)}
                onOpenWorkspace={() => switchView('workspace')}
                onOpenSettings={() => switchView('settings')}
                recentFolders={recentFolders}
                recentFiles={recentFiles}
                onOpenRecentFolder={async (path) => {
                  try {
                    await window.electronAPI?.setProjectRoot?.(path);
                    setProjectRoot(path);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                onOpenRecentFile={openFileInEditor}
              />
            )}
          </div>
          {showAIAssistant && (
            <div className="ai-assistant-panel">
              {activeTab ? (
                <AIChatPanel
                  currentFile={activeTab}
                  currentContent={activeTab.content}
                  selection={editorSelection}
                  initialPrompt={initialAIPrompt}
                  agentProfile={activeEmotionProfile}
                  onApplyEdit={(content) => {
                    if (activeTabId) updateTabContent(activeTabId, content);
                  }}
                  onInsertAtCursor={(text) => editorApiRef.current?.insertTextAtCursor(text)}
                  onShowDiff={(original, suggested) => {
                    setDiffOriginal(original);
                    setDiffSuggested(suggested);
                    setShowDiffView(true);
                  }}
                />
              ) : (
                <AIAssistant />
              )}
            </div>
          )}
        </div>
      </div>

      </div>

      {bottomPanelOpen && (
        <>
          <ResizeHandleHorizontal onResize={handlePanelResize} />
        <div className="bottom-panel" style={{ height: bottomPanelHeight, minHeight: 120, maxHeight: 600 }}>
          <div className="bottom-panel-tabs">
            <button type="button" className={`bottom-panel-tab ${bottomPanelTab === 'terminal' ? 'active' : ''}`} onClick={() => setBottomPanelTab('terminal')}>Terminal</button>
            <button type="button" className={`bottom-panel-tab ${bottomPanelTab === 'output' ? 'active' : ''}`} onClick={() => setBottomPanelTab('output')}>Output</button>
            <button type="button" className={`bottom-panel-tab ${bottomPanelTab === 'debug-console' ? 'active' : ''}`} onClick={() => setBottomPanelTab('debug-console')}>Debug Console</button>
            <button type="button" className={`bottom-panel-tab ${bottomPanelTab === 'ports' ? 'active' : ''}`} onClick={() => setBottomPanelTab('ports')}>Ports</button>
            <button type="button" className={`bottom-panel-tab ${bottomPanelTab === 'problems' ? 'active' : ''}`} onClick={() => setBottomPanelTab('problems')}>Problems</button>
            <button type="button" className={`bottom-panel-tab ${bottomPanelTab === 'finetuning' ? 'active' : ''}`} onClick={() => setBottomPanelTab('finetuning')}>Fine-tune</button>
            <button type="button" className={`bottom-panel-tab ${bottomPanelTab === 'tools' ? 'active' : ''}`} onClick={() => setBottomPanelTab('tools')}>Tools</button>
            <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setBottomPanelOpen(false)}>×</button>
          </div>
          <div className="bottom-panel-content">
            {bottomPanelTab === 'terminal' && <TerminalPanel projectRoot={projectRoot} />}
            {bottomPanelTab === 'output' && <OutputPanel logs={outputLogs} onClear={() => setOutputLogs([])} />}
            {bottomPanelTab === 'debug-console' && <DebugConsolePanel />}
            {bottomPanelTab === 'ports' && <PortsPanel />}
            {bottomPanelTab === 'finetuning' && <FineTuningPanel projectRoot={projectRoot} />}
            {bottomPanelTab === 'tools' && <ToolsPanel />}
            {bottomPanelTab === 'problems' && (
              <ProblemsPanel
                problems={problems}
                onSelect={(p) => editorApiRef.current?.goToLine(p.line)}
              />
            )}
          </div>
        </div>
        </>
      )}

      {createLauncherOpen && (
        <CreateLauncher
          onClose={() => setCreateLauncherOpen(false)}
          onOpenVisual={() => { switchView('visual'); setCreateLauncherOpen(false); }}
          onOpenEmotion={() => { switchView('emotion'); setCreateLauncherOpen(false); }}
          onNewFileFromTemplate={handleNewFileFromTemplate}
          projectRoot={projectRoot}
        />
      )}

      <QuickOpen
        isOpen={quickOpenOpen}
        onClose={() => setQuickOpenOpen(false)}
        openTabs={openTabs}
        projectRoot={projectRoot}
        onSelectTab={setActiveTabId}
        onSelectFile={openFileInEditor}
      />

      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onCommand={handleCommand} />

      <GoToSymbolModal
        isOpen={goToSymbolOpen}
        symbols={outlineSymbols}
        onSelect={(sym) => editorApiRef.current?.goToLine(sym.range?.startLineNumber)}
        onClose={() => setGoToSymbolOpen(false)}
      />

      {goToLineOpen && (
        <div className="go-to-line-backdrop" onClick={() => setGoToLineOpen(false)}>
          <div className="go-to-line-box" onClick={(e) => e.stopPropagation()}>
            <label>Go to line (Ctrl+G)</label>
            <input
              type="text"
              value={goToLineValue}
              onChange={(e) => setGoToLineValue(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setGoToLineOpen(false);
                if (e.key === 'Enter') {
                  const line = parseInt(goToLineValue, 10);
                  if (line > 0) editorApiRef.current?.goToLine(line);
                  setGoToLineOpen(false);
                }
              }}
              placeholder="Line number"
              autoFocus
            />
            <button type="button" onClick={() => {
              const line = parseInt(goToLineValue, 10);
              if (line > 0) editorApiRef.current?.goToLine(line);
              setGoToLineOpen(false);
            }}>Go</button>
          </div>
        </div>
      )}

      <Notifications />

      {showAbout && (
        <div className="about-backdrop" onClick={() => setShowAbout(false)} role="dialog" aria-modal="true">
          <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Deepiri Emotion</h2>
            <p className="about-version">Version {appVersion}</p>
            <p className="about-desc">AI-powered desktop IDE. Code, Visual canvas, Emotion agents, Cyrex &amp; Helox.</p>
            <button type="button" className="about-close" onClick={() => setShowAbout(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Mission Cards */}
      <div className="mission-container">
        {activeMissions.map(mission => (
          <MissionCard
            key={mission.id}
            mission={mission}
            onComplete={handleMissionComplete}
            onAbandon={handleMissionAbandon}
          />
        ))}
      </div>

      <ClassificationPanel selection={editorSelection} />

      <StatusBar
        cursorPosition={cursorPosition}
        language={activeTab ? getLanguage(activeTab.name) : (activeFile ? getLanguageFromFile(activeFile.name) : null)}
        projectRoot={projectRoot}
        problemsCount={problems.length}
        wordCount={activeTab?.content != null ? (activeTab.content.trim().split(/\s+/).filter(Boolean).length) : null}
        editorFontSize={editorFontSize}
        theme={theme}
        onZoomClick={zoomIn}
        onThemeCycle={() => {
          const opts = ['dark', 'light', 'hc'];
          setTheme(opts[(opts.indexOf(theme) + 1) % opts.length]);
        }}
        showAIAssistant={showAIAssistant}
        onAIClick={() => setShowAIAssistant((s) => !s)}
        onProblemsClick={() => { setBottomPanelOpen(true); setBottomPanelTab('problems'); }}
        onTerminalClick={() => { setBottomPanelOpen(true); setBottomPanelTab('terminal'); }}
        onOutputClick={() => { setBottomPanelOpen(true); setBottomPanelTab('output'); }}
        onPanelClick={() => setBottomPanelOpen((o) => !o)}
      />
    </div>
  );
};

function getLanguageFromFile(filename) {
  const ext = filename.split('.').pop();
  const langMap = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c'
  };
  return langMap[ext] || 'text';
}

export default App;

