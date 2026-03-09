import React, { useState, useRef, useEffect } from 'react';
import { escapeRegex } from '../../utils/string';
import SearchResultItem from '../../features/search/SearchResultItem';
import Spinner from '../ui/Spinner';

export default function SearchPanel({
  openTabs = [],
  projectRoot,
  onSelectTab,
  onSelectWorkspaceResult,
  onReplaceAll,
  focusRequest
}) {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [scope, setScope] = useState('open'); // 'open' | 'workspace'
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (focusRequest && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [focusRequest]);

  const searchInOpenTabs = () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const q = escapeRegex(query);
    const re = wholeWord
      ? new RegExp(`\\b${q}\\b`, caseSensitive ? 'g' : 'gi')
      : new RegExp(q, caseSensitive ? 'g' : 'gi');
    const out = [];
    openTabs.forEach((tab) => {
      const content = tab.content || '';
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        let match;
        while ((match = re.exec(line)) !== null) {
          out.push({
            tabId: tab.id,
            path: tab.path,
            name: tab.name,
            line: i + 1,
            column: match.index + 1,
            text: line.trim().slice(0, 80)
          });
        }
      });
    });
    setResults(out);
  };

  const searchInWorkspace = async () => {
    if (!query.trim() || !projectRoot || !window.electronAPI?.searchInFolder) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const list = await window.electronAPI.searchInFolder(projectRoot, query, {
        caseSensitive,
        wholeWord
      });
      setResults(list);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const runSearch = () => {
    if (scope === 'workspace') searchInWorkspace();
    else searchInOpenTabs();
  };

  const handleResultClick = (r) => {
    if (r.tabId != null && onSelectTab) {
      onSelectTab(r.tabId, r.line);
    } else if (r.path && onSelectWorkspaceResult) {
      onSelectWorkspaceResult({ path: r.path, name: r.name, line: r.line });
    }
  };

  const canReplace = scope === 'open' && results.some((r) => r.tabId != null) && query.trim();
  const handleReplaceAll = () => {
    if (!canReplace || !onReplaceAll || !replaceText.trim()) return;
    onReplaceAll(results.filter((r) => r.tabId != null), replaceText, { caseSensitive, wholeWord, query: query.trim() });
  };

  return (
    <div className="search-panel">
      <div className="search-header">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={scope === 'workspace' ? 'Search in workspace (Ctrl+Shift+F)' : 'Search in open files'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
        />
        <button type="button" className={`btn-primary ${searching ? 'search-btn-loading' : ''}`} onClick={runSearch} disabled={searching}>
          {searching ? <><Spinner size={14} /> Searching…</> : 'Search'}
        </button>
      </div>
      <div className="search-replace-row">
        <input
          type="text"
          className="search-input search-replace-input"
          placeholder="Replace (open files only)"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          disabled={scope !== 'open'}
        />
        <button
          type="button"
          className="btn-primary"
          onClick={handleReplaceAll}
          disabled={!canReplace}
          title="Replace all in open files"
        >
          Replace All
        </button>
      </div>
      <div className="search-options">
        <span className="search-scope">
          <label>
            <input type="radio" checked={scope === 'open'} onChange={() => setScope('open')} />
            Open files
          </label>
          <label>
            <input type="radio" checked={scope === 'workspace'} onChange={() => setScope('workspace')} disabled={!projectRoot} />
            Workspace
          </label>
        </span>
        <label>
          <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
          Match case
        </label>
        <label>
          <input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} />
          Whole word
        </label>
      </div>
      <div className="search-results">
        {results.length === 0 && query && !searching && (
          <div className="search-no-results">No results</div>
        )}
        {results.length > 0 && (
          <div className="search-result-count">{results.length} result(s)</div>
        )}
        {results.slice(0, 200).map((r, i) => (
          <SearchResultItem
            key={r.tabId ? `${r.tabId}-${r.line}-${i}` : `${r.path}-${r.line}-${i}`}
            result={r}
            onClick={() => handleResultClick(r)}
          />
        ))}
        {results.length > 200 && (
          <div className="search-more">… and {results.length - 200} more</div>
        )}
      </div>
    </div>
  );
}
