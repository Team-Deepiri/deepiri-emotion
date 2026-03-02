import React, { useState, useEffect, useCallback, useRef } from 'react';
import CodeEditor from './components/CodeEditor';
import FileExplorer from './components/FileExplorer';
import ChallengePanel from './components/ChallengePanel';
import GamificationWidget from './components/GamificationWidget';
import TaskManager from './components/TaskManager';
import AIAssistant from './components/AIAssistant';
import Terminal from './components/Terminal';
import Settings from './components/Settings';
import IntegrationPanel from './components/IntegrationPanel';
import MissionCard from './components/MissionCard';
import CyrexEmbed from './components/CyrexEmbed';
import PipelinesView from './components/PipelinesView';
import MonacoEditor from './components/editor/MonacoEditor';
import EditorTabs from './components/editor/EditorTabs';
import WorkspaceFileExplorer from './components/workspace/WorkspaceFileExplorer';
import CommandPalette from './components/CommandPalette';
import StatusBar from './components/StatusBar';
import TerminalPanel from './components/panels/TerminalPanel';
import OutputPanel from './components/panels/OutputPanel';
import ProblemsPanel from './components/panels/ProblemsPanel';
import SearchPanel from './components/panels/SearchPanel';
import OutlinePanel from './components/panels/OutlinePanel';
import KeybindingsPanel from './components/panels/KeybindingsPanel';
import ExtensionsPanel from './components/panels/ExtensionsPanel';
import WelcomeScreen from './components/WelcomeScreen';
import QuickOpen from './features/quick-open/QuickOpen';
import AIChatPanel from './features/ai-chat/AIChatPanel';
import DiffView from './features/generation/DiffView';
import Breadcrumbs from './components/Breadcrumbs';
import Notifications from './components/Notifications';
import { useSession } from './hooks/useSession';
import { useKeybindings } from './hooks/useKeybindings';
import { useTheme } from './context/ThemeContext';
import { getLanguage } from './components/editor/MonacoEditor';
import './services/aiService';
import './services/challengeService';
import './services/taskService';
import './integrations/github';
import './integrations/notion';

let tabIdCounter = 0;
function nextTabId() {
  return `tab-${++tabIdCounter}`;
}

const App = () => {
  const [activeFile, setActiveFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [activeChallenge, setActiveChallenge] = useState(null);
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
  const [initialAIPrompt, setInitialAIPrompt] = useState(null);
  const editorApiRef = useRef(null);
  const userId = localStorage.getItem('user_id') || 'default_user';
  const { recordKeystroke, recordFileChange } = useSession(userId);
  const { monacoTheme, theme, setTheme, editorFontSize, zoomIn, zoomOut, zoomReset } = useTheme();
  const recentFolders = typeof window !== 'undefined' && window.recentService ? window.recentService.getRecentFolders() : [];

  useEffect(() => {
    if (window.electronAPI?.getProjectRoot) {
      window.electronAPI.getProjectRoot().then((root) => root && setProjectRoot(root));
    }
  }, []);

  useEffect(() => {
    if (pendingGoToLine == null || !activeTabId) return;
    const t = setTimeout(() => {
      editorApiRef.current?.goToLine(pendingGoToLine);
      setPendingGoToLine(null);
    }, 200);
    return () => clearTimeout(t);
  }, [activeTabId, pendingGoToLine]);

  const initializeApp = async () => {
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
    const targetView = document.getElementById(`${view}-view`);
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
  }, [openTabs]);

  const updateTabContent = useCallback((tabId, content, dirty = true) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, content, dirty } : t))
    );
  }, []);

  const closeTab = useCallback((tabId) => {
    const tab = openTabs.find((t) => t.id === tabId);
    if (tab?.dirty && !window.confirm('Close without saving?')) return;
    setOpenTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (activeTabId === tabId) {
      const rest = openTabs.filter((t) => t.id !== tabId);
      setActiveTabId(rest.length ? rest[rest.length - 1].id : null);
    }
  }, [openTabs, activeTabId]);

  const saveActiveTab = useCallback(async () => {
    const tab = openTabs.find((t) => t.id === activeTabId);
    if (!tab?.path || tab.path.startsWith('/tasks/')) return;
    try {
      await window.electronAPI.saveFile({ path: tab.path, content: tab.content });
      setOpenTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, dirty: false } : t))
      );
      recordFileChange(tab.path, 'save', {});
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
      await openFileInEditor({ path, name: fileName });
    } catch (e) {
      console.error(e);
      if (window.toast || window.electronAPI?.showError) {
        (window.toast || window.electronAPI.showError)(e.message || 'Failed to create file');
      }
    }
  }, [projectRoot, openFileInEditor, handleOpenFolder]);

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
    { key: 's', ctrlKey: true, action: (e) => { e.preventDefault(); saveActiveTab(); } },
    { key: 'o', ctrlKey: true, action: (e) => { e.preventDefault(); handleOpenFolder(); } },
    { key: 'g', ctrlKey: true, action: (e) => { e.preventDefault(); setGoToLineOpen(true); setGoToLineValue(''); } },
    { key: 'f', ctrlKey: true, shiftKey: true, action: (e) => { e.preventDefault(); switchView('search'); setFocusSearchRequest((n) => n + 1); } },
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
    else if (cmdId === 'toggle-terminal') { setBottomPanelOpen(true); setBottomPanelTab('terminal'); }
    else if (cmdId === 'toggle-output') { setBottomPanelOpen(true); setBottomPanelTab('output'); }
    else if (cmdId === 'toggle-problems') { setBottomPanelOpen(true); setBottomPanelTab('problems'); }
    else if (cmdId === 'toggle-ai') setShowAIAssistant((v) => !v);
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
    else if (cmdId === 'keybindings') switchView('keybindings');
    else if (cmdId === 'extensions') switchView('extensions');
    else if (cmdId === 'outline') switchView('outline');
    else if (cmdId === 'go-to-line') setGoToLineOpen(true);
    else if (cmdId === 'format-document') editorApiRef.current?.formatDocument();
    else if (cmdId === 'focus-search') { switchView('search'); setFocusSearchRequest((n) => n + 1); }
    else if (cmdId === 'settings') switchView('integrations');
    else if (cmdId === 'new-task') {
      const title = window.prompt('Task title');
      if (title) window.taskService?.createTask(title).then(() => loadFiles());
    }
  }, [handleOpenFolder, handleNewFile, saveActiveTab, loadFiles]);

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  return (
    <div className="ide-container">
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
          className={`activity-item ${showAIAssistant ? 'active' : ''}`}
          onClick={() => setShowAIAssistant(!showAIAssistant)}
          title="AI Chat"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </div>
      </div>

      <div className="sidebar" id="sidebar">
        <div className="sidebar-content" id="explorer-view">
          {projectRoot ? (
            <WorkspaceFileExplorer
              projectRoot={projectRoot}
              selectedPath={activeTab?.path}
              onSelectFile={openFileInEditor}
              onRefresh={() => window.electronAPI?.getProjectRoot().then((r) => r && setProjectRoot(r))}
            />
          ) : (
            <>
              <div className="sidebar-header"><span>EXPLORER</span></div>
              <FileExplorer files={files} onFileSelect={handleFileSelect} />
            </>
          )}
        </div>

        <div className="sidebar-content hidden" id="challenges-view">
          <div className="sidebar-header">
            <span>CHALLENGES</span>
          </div>
          <ChallengePanel
            onChallengeStart={handleChallengeStart}
            onChallengeComplete={(id) => {
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
          <p style={{ padding: 8, fontSize: 12, color: '#888' }}>
            Agent Playground, RAG, Workflows, and more load in the main area. Start the Cyrex interface on port 5175 for full UI.
          </p>
        </div>

        <div className="sidebar-content hidden" id="pipelines-view">
          <div className="sidebar-header">
            <span>PIPELINES</span>
          </div>
          <p style={{ padding: 8, fontSize: 12, color: '#888' }}>
            Run and cancel from the main area. Select a pipeline and click Run.
          </p>
        </div>

        <div className="sidebar-content hidden" id="search-view">
          <div className="sidebar-header">
            <span>SEARCH</span>
          </div>
          <p style={{ padding: 8, fontSize: 12, color: '#888' }}>
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
      </div>

        <div className="editor-area" style={{ minWidth: 0 }}>
        {openTabs.length > 0 && (
          <EditorTabs
            tabs={openTabs}
            activeId={activeTabId}
            onSelect={setActiveTabId}
            onClose={closeTab}
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
            ) : currentView === 'cyrex' ? (
              <CyrexEmbed />
            ) : currentView === 'pipelines' ? (
              <PipelinesView />
            ) : currentView === 'search' ? (
              <SearchPanel
                openTabs={openTabs}
                projectRoot={projectRoot}
                onSelectTab={(tabId, line) => {
                  setActiveTabId(tabId);
                  setTimeout(() => editorApiRef.current?.goToLine(line), 50);
                }}
                onSelectWorkspaceResult={handleSelectWorkspaceResult}
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
                recentFolders={recentFolders}
                onOpenRecentFolder={(path) => setProjectRoot(path)}
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
        <div className="bottom-panel">
          <div className="bottom-panel-tabs">
            <button type="button" className={`bottom-panel-tab ${bottomPanelTab === 'terminal' ? 'active' : ''}`} onClick={() => setBottomPanelTab('terminal')}>Terminal</button>
            <button type="button" className={`bottom-panel-tab ${bottomPanelTab === 'output' ? 'active' : ''}`} onClick={() => setBottomPanelTab('output')}>Output</button>
            <button type="button" className={`bottom-panel-tab ${bottomPanelTab === 'problems' ? 'active' : ''}`} onClick={() => setBottomPanelTab('problems')}>Problems</button>
            <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setBottomPanelOpen(false)}>×</button>
          </div>
          <div className="bottom-panel-content">
            {bottomPanelTab === 'terminal' && <TerminalPanel projectRoot={projectRoot} />}
            {bottomPanelTab === 'output' && <OutputPanel logs={outputLogs} onClear={() => setOutputLogs([])} />}
            {bottomPanelTab === 'problems' && (
              <ProblemsPanel
                problems={problems}
                onSelect={(p) => editorApiRef.current?.goToLine(p.line)}
              />
            )}
          </div>
        </div>
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

      <StatusBar
        cursorPosition={cursorPosition}
        language={activeTab ? getLanguage(activeTab.name) : (activeFile ? getLanguageFromFile(activeFile.name) : null)}
        projectRoot={projectRoot}
        problemsCount={problems.length}
        wordCount={activeTab?.content != null ? (activeTab.content.trim().split(/\s+/).filter(Boolean).length) : null}
        theme={theme}
        onThemeCycle={() => {
          const opts = ['dark', 'light', 'hc'];
          setTheme(opts[(opts.indexOf(theme) + 1) % opts.length]);
        }}
        showAIAssistant={showAIAssistant}
        onAIClick={() => setShowAIAssistant((s) => !s)}
        onProblemsClick={() => { setBottomPanelOpen(true); setBottomPanelTab('problems'); }}
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

