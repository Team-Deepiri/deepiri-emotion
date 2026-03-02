import React, { useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';

const LANGUAGE_MAP = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  json: 'json',
  md: 'markdown',
  html: 'html',
  css: 'css',
  scss: 'scss',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'shell',
  bash: 'shell',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp'
};

function getLanguage(filename) {
  const ext = (filename || '').split('.').pop() || '';
  return LANGUAGE_MAP[ext] || 'plaintext';
}

function fetchDocumentSymbols(editor, monaco, onSymbolsChange) {
  const model = editor.getModel();
  if (!model || !onSymbolsChange) return;
  monaco.languages.getDocumentSymbols(model.uri)
    .then((symbols) => onSymbolsChange(symbols || []))
    .catch(() => onSymbolsChange([]));
}

export default function MonacoEditor({
  path,
  value,
  onChange,
  onSave,
  onCursorChange,
  onSelectionChange,
  onSymbolsChange,
  onEditorReady,
  onProblemsChange,
  theme = 'vs-dark',
  fontSize = 14,
  options = {},
  height = '100%'
}) {
  const editorRef = useRef(null);
  const language = getLanguage(path);

  const handleEditorDidMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    editor.addAction({
      id: 'save',
      label: 'Save',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {
        if (onSave) onSave();
      }
    });
    if (onCursorChange) {
      editor.onDidChangeCursorPosition((e) => {
        onCursorChange({
          lineNumber: e.position.lineNumber,
          column: e.position.column
        });
      });
    }
    if (onSelectionChange) {
      editor.onDidChangeCursorSelection(() => {
        const sel = editor.getSelection();
        if (!sel) return;
        const text = editor.getModel()?.getValueInRange(sel) ?? '';
        onSelectionChange(text);
      });
    }
    if (onSymbolsChange) {
      fetchDocumentSymbols(editor, monaco, onSymbolsChange);
      const model = editor.getModel();
      if (model) {
        model.onDidChangeContent(() => fetchDocumentSymbols(editor, monaco, onSymbolsChange));
      }
    }
    if (onProblemsChange) {
      const model = editor.getModel();
      if (model) {
        const uri = model.uri;
        const update = () => {
          const markers = monaco.editor.getModelMarkers({ resource: uri });
          onProblemsChange(markers.map((m) => ({
            path,
            line: m.startLineNumber,
            message: m.message,
            severity: m.severity === monaco.MarkerSeverity.Error ? 'error' : m.severity === monaco.MarkerSeverity.Warning ? 'warning' : 'info'
          })));
        };
        const disposable = monaco.editor.onDidChangeMarkers((resources) => {
          if (resources.some((r) => r.toString() === uri.toString())) update();
        });
        update();
      }
    }
    if (onEditorReady) {
      onEditorReady({
        goToLine(lineNumber) {
          if (!editorRef.current) return;
          editorRef.current.revealLineInCenter(lineNumber);
          editorRef.current.setPosition({ lineNumber, column: 1 });
          editorRef.current.focus();
        },
        insertTextAtCursor(text) {
          if (!editorRef.current) return;
          const selection = editorRef.current.getSelection();
          if (!selection) return;
          editorRef.current.executeEdits('insert-at-cursor', [{ range: selection, text }]);
        },
        formatDocument() {
          if (!editorRef.current) return;
          editorRef.current.getAction('editor.action.formatDocument')?.run();
        },
        triggerFind() {
          if (!editorRef.current) return;
          editorRef.current.focus();
          editorRef.current.getAction('editor.action.startFind')?.run();
        },
        triggerReplace() {
          if (!editorRef.current) return;
          editorRef.current.focus();
          editorRef.current.getAction('editor.action.startFindReplaceAction')?.run();
        }
      });
    }
  }, [onSave, onCursorChange, onSelectionChange, onSymbolsChange, onProblemsChange, onEditorReady, path]);

  const handleChange = useCallback((newValue) => {
    if (onChange) onChange(newValue ?? '');
  }, [onChange]);

  return (
    <div className="monaco-editor-wrap" style={{ height, width: '100%' }}>
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme={theme}
        loading={<div className="monaco-loading">Loading editor…</div>}
        options={{
          minimap: { enabled: true },
          fontSize,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          folding: true,
          bracketPairColorization: { enabled: true },
          ...options
        }}
      />
    </div>
  );
}

export { getLanguage };
