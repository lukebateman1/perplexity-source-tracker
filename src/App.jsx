import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, ExternalLink, Plus, Trash2, ChevronDown, ChevronRight,
  LayoutDashboard, Tag, Sparkles, Play, Loader2, Key, X,
  Settings, RefreshCw, Clock, AlertCircle, Check
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend
} from 'recharts';
import { CATEGORIES, CATEGORY_OPTIONS, MODEL_OPTIONS, estimateCostClient } from './lib/categories.js';
import * as api from './lib/api.js';

// ============================================================
// SMALL REUSABLE PIECES
// ============================================================

const Badge = ({ category }) => {
  const cat = CATEGORIES[category] || CATEGORIES.unknown;
  const Icon = cat.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: cat.bgColor, color: cat.color }}
    >
      <Icon size={11} />
      {cat.label}
    </span>
  );
};

const StatCard = ({ label, value, sub, color }) => (
  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
    <p className="text-sm text-slate-400 mb-1">{label}</p>
    <p className={`text-2xl font-semibold ${color || 'text-white'}`}>{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
);

const EmptyState = ({ icon: Icon, title, sub }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Icon size={40} className="text-slate-600 mb-4" />
    <p className="text-slate-400 font-medium">{title}</p>
    {sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg shadow-xl text-sm">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#fff' }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================

const App = () => {
  // --- Global state ---
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('pplx_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard | client | domain-tags
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // --- Client view state ---
  const [activeTab, setActiveTab] = useState('queries'); // queries | results | history | charts
  const [queries, setQueries] = useState([]);
  const [newQueryText, setNewQueryText] = useState('');
  const [selectedQueryIds, setSelectedQueryIds] = useState(new Set());
  const [selectedModel, setSelectedModel] = useState('sonar');
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState('');
  const [latestResults, setLatestResults] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [expandedRuns, setExpandedRuns] = useState(new Set());

  // --- Domain tags state ---
  const [domainTags, setDomainTags] = useState([]);
  const [tagFilter, setTagFilter] = useState('all');
  const [newTagDomain, setNewTagDomain] = useState('');
  const [newTagCategory, setNewTagCategory] = useState('news');

  // --- New client state ---
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientDomains, setNewClientDomains] = useState('');

  // --- Error state ---
  const [error, setError] = useState(null);

  // --- Persist API key ---
  useEffect(() => {
    if (apiKey) localStorage.setItem('pplx_api_key', apiKey);
    else localStorage.removeItem('pplx_api_key');
  }, [apiKey]);

  // --- Load clients on mount ---
  useEffect(() => {
    api.getClients().then(setClients).catch(console.error);
  }, []);

  // --- Load client data when selection changes ---
  const selectedClient = clients.find(c => c.id === selectedClientId);

  const loadQueries = useCallback(async (clientId) => {
    try {
      const q = await api.getClientQueries(clientId);
      setQueries(q);
    } catch (e) { console.error(e); }
  }, []);

  const loadHistory = useCallback(async (clientId) => {
    try {
      const h = await api.getClientHistory(clientId);
      setHistory(h);
    } catch (e) { console.error(e); }
  }, []);

  const loadStats = useCallback(async (clientId) => {
    try {
      const s = await api.getClientStats(clientId);
      setStats(s);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadQueries(selectedClientId);
      setLatestResults(null);
      setHistory([]);
      setStats(null);
      setSelectedQueryIds(new Set());
      setActiveTab('queries');
    }
  }, [selectedClientId, loadQueries]);

  useEffect(() => {
    if (selectedClientId && (activeTab === 'history' || activeTab === 'charts')) loadHistory(selectedClientId);
    if (selectedClientId && (activeTab === 'charts' || activeTab === 'results')) loadStats(selectedClientId);
  }, [selectedClientId, activeTab, loadHistory, loadStats]);

  // --- Client CRUD ---
  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const domains = newClientDomains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
      const client = await api.createClient(newClientName.trim(), domains);
      setClients(prev => [client, ...prev]);
      setNewClientName('');
      setNewClientDomains('');
      setShowNewClient(false);
      setSelectedClientId(client.id);
      setCurrentView('client');
    } catch (e) { setError(e.message); }
  };

  const handleDeleteClient = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this client and all associated data?')) return;
    try {
      await api.deleteClient(id);
      setClients(prev => prev.filter(c => c.id !== id));
      if (selectedClientId === id) {
        setSelectedClientId(null);
        setCurrentView('dashboard');
      }
    } catch (e) { setError(e.message); }
  };

  // --- Query management ---
  const handleAddQueries = async () => {
    if (!newQueryText.trim() || !selectedClientId) return;
    try {
      const lines = newQueryText.split('\n').filter(l => l.trim());
      await api.addQueries(selectedClientId, lines);
      setNewQueryText('');
      loadQueries(selectedClientId);
    } catch (e) { setError(e.message); }
  };

  const handleDeleteQuery = async (id) => {
    try {
      await api.deleteQuery(id);
      setQueries(prev => prev.filter(q => q.id !== id));
      setSelectedQueryIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e) { setError(e.message); }
  };

  const toggleQuerySelection = (id) => {
    setSelectedQueryIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedQueryIds.size === queries.length) {
      setSelectedQueryIds(new Set());
    } else {
      setSelectedQueryIds(new Set(queries.map(q => q.id)));
    }
  };

  // --- Run analysis ---
  const handleRunSelected = async () => {
    if (selectedQueryIds.size === 0 || !apiKey) {
      setError(!apiKey ? 'Please set your Perplexity API key first' : 'Select at least one query');
      return;
    }
    setIsRunning(true);
    setError(null);
    setLatestResults(null);

    try {
      const ids = Array.from(selectedQueryIds);
      setRunProgress(`Running ${ids.length} ${ids.length === 1 ? 'query' : 'queries'}...`);

      const result = await api.analyzeBatch(ids, apiKey, selectedModel);
      setLatestResults(result);
      setActiveTab('results');
      loadQueries(selectedClientId);
      loadStats(selectedClientId);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsRunning(false);
      setRunProgress('');
    }
  };

  // --- Domain tags ---
  const loadDomainTags = async () => {
    try {
      const tags = await api.getDomainTags();
      setDomainTags(tags);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (currentView === 'domain-tags') loadDomainTags();
  }, [currentView]);

  const handleAddTag = async () => {
    if (!newTagDomain.trim()) return;
    try {
      await api.addDomainTag(newTagDomain.trim(), newTagCategory);
      setNewTagDomain('');
      loadDomainTags();
    } catch (e) { setError(e.message); }
  };

  const handleDeleteTag = async (id) => {
    try {
      await api.deleteDomainTag(id);
      setDomainTags(prev => prev.filter(t => t.id !== id));
    } catch (e) { setError(e.message); }
  };

  const handleInlineTag = async (domain, category) => {
    try {
      await api.addDomainTag(domain, category);
      // Refresh results to reflect the new tag
      if (selectedClientId) {
        loadStats(selectedClientId);
        if (activeTab === 'history') loadHistory(selectedClientId);
      }
    } catch (e) { setError(e.message); }
  };

  // --- Cost estimate ---
  const estimatedCost = estimateCostClient(selectedModel, selectedQueryIds.size);

  // ============================================================
  // RENDER: SIDEBAR
  // ============================================================

  const renderSidebar = () => (
    <div className="w-64 h-screen bg-slate-900/60 border-r border-slate-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-800">
        <h1 className="text-lg font-semibold text-white tracking-tight">
          <span className="text-blue-400">Perplexity</span> Tracker
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Source Intelligence</p>
      </div>

      {/* Nav */}
      <div className="px-3 py-3 space-y-1">
        <button
          onClick={() => { setCurrentView('dashboard'); setSelectedClientId(null); }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            currentView === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <LayoutDashboard size={16} /> Dashboard
        </button>
        <button
          onClick={() => setCurrentView('domain-tags')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            currentView === 'domain-tags' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Tag size={16} /> Domain Tags
        </button>
      </div>

      {/* Clients */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Clients</p>
        <button
          onClick={() => setShowNewClient(!showNewClient)}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* New client form */}
      {showNewClient && (
        <div className="px-3 pb-2 space-y-2 animate-fade-in">
          <input
            type="text"
            placeholder="Client name"
            value={newClientName}
            onChange={e => setNewClientName(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            onKeyDown={e => e.key === 'Enter' && handleCreateClient()}
            autoFocus
          />
          <input
            type="text"
            placeholder="Owned domains (comma-sep)"
            value={newClientDomains}
            onChange={e => setNewClientDomains(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            onKeyDown={e => e.key === 'Enter' && handleCreateClient()}
          />
          <button
            onClick={handleCreateClient}
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
          >
            Create
          </button>
        </div>
      )}

      {/* Client list */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
        {clients.map(client => (
          <button
            key={client.id}
            onClick={() => { setSelectedClientId(client.id); setCurrentView('client'); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group ${
              selectedClientId === client.id && currentView === 'client'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <span className="truncate">{client.name}</span>
            <button
              onClick={(e) => handleDeleteClient(client.id, e)}
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </button>
        ))}
        {clients.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-4">No clients yet</p>
        )}
      </div>

      {/* API Key */}
      <div className="border-t border-slate-800 px-3 py-3">
        {showKeyInput ? (
          <div className="space-y-2 animate-fade-in">
            <input
              type="password"
              placeholder="pplx-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowKeyInput(false)} className="flex-1 py-1 text-xs text-slate-400 hover:text-white">Done</button>
              <button onClick={() => { setApiKey(''); setShowKeyInput(false); }} className="flex-1 py-1 text-xs text-red-400 hover:text-red-300">Clear</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowKeyInput(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <Key size={14} />
            {apiKey ? 'API Key ✓' : 'Set API Key'}
          </button>
        )}
      </div>
    </div>
  );

  // ============================================================
  // RENDER: DASHBOARD
  // ============================================================

  const renderDashboard = () => (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-semibold text-white mb-6">Dashboard</h2>

        {clients.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title="No clients yet"
            sub="Create a client in the sidebar to get started"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map(client => (
              <DashboardClientCard
                key={client.id}
                client={client}
                onClick={() => { setSelectedClientId(client.id); setCurrentView('client'); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================================
  // RENDER: CLIENT VIEW
  // ============================================================

  const renderClientView = () => {
    if (!selectedClient) return null;

    return (
      <div className="flex-1 overflow-y-auto">
        {/* Client header */}
        <div className="border-b border-slate-800 px-8 pt-6 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">{selectedClient.name}</h2>
              <p className="text-sm text-slate-500 mt-0.5 font-mono">
                {selectedClient.ownedDomains?.join(', ') || 'No owned domains set'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {MODEL_OPTIONS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {[
              { key: 'queries', label: 'Queries' },
              { key: 'results', label: 'Latest Results' },
              { key: 'history', label: 'History' },
              { key: 'charts', label: 'Charts' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.key
                    ? 'bg-slate-800 text-white border-t-2 border-blue-500'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-8">
          {activeTab === 'queries' && renderQueriesTab()}
          {activeTab === 'results' && renderResultsTab()}
          {activeTab === 'history' && renderHistoryTab()}
          {activeTab === 'charts' && renderChartsTab()}
        </div>
      </div>
    );
  };

  // --- QUERIES TAB ---
  const renderQueriesTab = () => (
    <div className="max-w-4xl space-y-6">
      {/* Add queries */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Add Queries</h3>
        <textarea
          value={newQueryText}
          onChange={e => setNewQueryText(e.target.value)}
          placeholder={"Enter queries, one per line:\nWhat is Midnight blockchain?\nBest privacy-focused blockchains 2025\nCardano partner chains explained"}
          rows={4}
          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none font-mono"
        />
        <button
          onClick={handleAddQueries}
          disabled={!newQueryText.trim()}
          className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-colors"
        >
          Add Queries
        </button>
      </div>

      {/* Query list */}
      {queries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {selectedQueryIds.size === queries.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-xs text-slate-600">
                {selectedQueryIds.size} of {queries.length} selected
              </span>
            </div>
            <div className="flex items-center gap-4">
              {selectedQueryIds.size > 0 && (
                <span className="text-xs text-slate-500">
                  Est. cost: ${estimatedCost.toFixed(4)}
                </span>
              )}
              <button
                onClick={handleRunSelected}
                disabled={isRunning || selectedQueryIds.size === 0 || !apiKey}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-colors"
              >
                {isRunning ? (
                  <><Loader2 size={14} className="animate-spin" /> {runProgress}</>
                ) : (
                  <><Play size={14} /> Run Selected</>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {queries.map(q => (
              <div
                key={q.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors cursor-pointer group ${
                  selectedQueryIds.has(q.id)
                    ? 'bg-blue-600/10 border-blue-500/30'
                    : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
                }`}
                onClick={() => toggleQuerySelection(q.id)}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selectedQueryIds.has(q.id)
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-slate-600'
                }`}>
                  {selectedQueryIds.has(q.id) && <Check size={10} className="text-white" />}
                </div>
                <span className="flex-1 text-sm text-slate-200">{q.queryText}</span>
                <span className="text-xs text-slate-500">
                  {q.runCount > 0 ? `${q.runCount} runs` : 'No runs'}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteQuery(q.id); }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {queries.length === 0 && (
        <EmptyState icon={Search} title="No queries yet" sub="Add queries above to start tracking" />
      )}
    </div>
  );

  // --- RESULTS TAB ---
  const renderResultsTab = () => {
    if (!latestResults) {
      return <EmptyState icon={Sparkles} title="No results yet" sub="Run queries from the Queries tab to see results" />;
    }

    const { results, totalCost } = latestResults;
    const allCitations = results.flatMap(r => r.citations || []);
    const totalCitationCount = results.reduce((s, r) => s + (r.citationCount || 0), 0);
    const totalOwned = results.reduce((s, r) => s + (r.ownedCitationCount || 0), 0);

    // Build category breakdown from all citations
    const catCounts = {};
    allCitations.forEach(c => { catCounts[c.category] = (catCounts[c.category] || 0) + 1; });
    const pieData = Object.entries(catCounts).map(([cat, count]) => ({
      name: CATEGORIES[cat]?.label || cat,
      value: count,
      category: cat,
    }));

    return (
      <div className="max-w-5xl space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Queries Run" value={results.length} />
          <StatCard label="Total Citations" value={totalCitationCount} />
          <StatCard label="Owned Citations" value={totalOwned} color="text-green-400" />
          <StatCard label="Cost" value={`$${totalCost.toFixed(4)}`} color="text-amber-400" />
        </div>

        {/* Pie chart */}
        {pieData.length > 0 && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Category Breakdown</h3>
            <div className="flex items-center gap-8">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                      {pieData.map(e => <Cell key={e.category} fill={CATEGORIES[e.category]?.color || '#64748b'} stroke="transparent" />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {pieData.map(item => (
                  <div key={item.category} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORIES[item.category]?.color }} />
                    <span className="text-sm text-slate-300">{item.name}</span>
                    <span className="text-sm text-slate-500">({item.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Per-query results */}
        {results.map((result, idx) => (
          <ResultCard
            key={result.queryId || idx}
            result={result}
            expanded={expandedRuns.has(result.queryId)}
            onToggle={() => setExpandedRuns(prev => {
              const n = new Set(prev);
              n.has(result.queryId) ? n.delete(result.queryId) : n.add(result.queryId);
              return n;
            })}
            onTag={handleInlineTag}
          />
        ))}
      </div>
    );
  };

  // --- HISTORY TAB ---
  const renderHistoryTab = () => {
    if (history.length === 0) {
      return <EmptyState icon={Clock} title="No run history" sub="Run some queries first to see history" />;
    }

    // Group by query
    const grouped = {};
    history.forEach(run => {
      const key = run.queryText;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(run);
    });

    return (
      <div className="max-w-5xl space-y-4">
        {Object.entries(grouped).map(([queryText, runs]) => (
          <div key={queryText} className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/50">
              <p className="text-sm font-medium text-white">{queryText}</p>
              <p className="text-xs text-slate-500">{runs.length} {runs.length === 1 ? 'run' : 'runs'}</p>
            </div>
            {runs.map(run => (
              <div key={run.id} className="border-b border-slate-700/30 last:border-0">
                <button
                  onClick={() => setExpandedRuns(prev => {
                    const n = new Set(prev);
                    n.has(run.id) ? n.delete(run.id) : n.add(run.id);
                    return n;
                  })}
                  className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-slate-800/40 transition-colors"
                >
                  {expandedRuns.has(run.id) ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  <span className="text-xs text-slate-400 font-mono">{new Date(run.createdAt).toLocaleString()}</span>
                  <span className="text-xs text-slate-500">{run.model}</span>
                  <span className="text-xs text-slate-400">{run.citationCount} citations</span>
                  <span className="text-xs text-green-400">{run.ownedCitationCount} owned</span>
                </button>
                {expandedRuns.has(run.id) && run.citations && (
                  <div className="px-5 pb-3 space-y-1 animate-fade-in">
                    {run.citations.map((c, i) => (
                      <CitationRow key={i} citation={c} onTag={handleInlineTag} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  // --- CHARTS TAB ---
  const renderChartsTab = () => {
    if (!stats || stats.totalRuns === 0) {
      return <EmptyState icon={Sparkles} title="No data yet" sub="Run queries to generate charts" />;
    }

    const pieData = (stats.categoryBreakdown || []).map(b => ({
      name: CATEGORIES[b.category]?.label || b.category,
      value: b.count,
      category: b.category,
    }));

    const barData = (stats.topDomains || []).map(d => ({
      domain: d.domain.length > 25 ? d.domain.slice(0, 25) + '…' : d.domain,
      count: d.count,
      category: d.category,
    }));

    // Build over-time data from history
    const timeData = history.map(run => ({
      date: new Date(run.createdAt).toLocaleDateString(),
      citations: run.citationCount,
      owned: run.ownedCitationCount,
      ownedPct: run.citationCount > 0 ? Math.round((run.ownedCitationCount / run.citationCount) * 100) : 0,
    })).reverse();

    return (
      <div className="max-w-5xl space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category pie */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Source Categories</h3>
            {pieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                      {pieData.map(e => <Cell key={e.category} fill={CATEGORIES[e.category]?.color || '#64748b'} stroke="transparent" />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend formatter={(value) => <span className="text-sm text-slate-300">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-slate-500 text-center py-8">No data</p>}
          </div>

          {/* Top domains bar */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Top Domains</h3>
            {barData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis dataKey="domain" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={140} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Citations" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-slate-500 text-center py-8">No data</p>}
          </div>
        </div>

        {/* Over time charts */}
        {timeData.length > 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Citations Over Time</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="citations" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="owned" name="Owned" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                    <Legend formatter={(value) => <span className="text-sm text-slate-300">{value}</span>} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Owned Citation Rate (%)</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="ownedPct" name="Owned %" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Runs" value={stats.totalRuns} />
          <StatCard label="Total Citations" value={stats.totalCitations} />
          <StatCard label="Owned Citations" value={stats.totalOwnedCitations} color="text-green-400" />
          <StatCard label="Avg Citations/Run" value={stats.avgCitationsPerRun} />
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER: DOMAIN TAGS
  // ============================================================

  const renderDomainTags = () => {
    const categories = ['all', ...Object.keys(CATEGORIES)];
    const filtered = tagFilter === 'all' ? domainTags : domainTags.filter(t => t.category === tagFilter);

    return (
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-2xl font-semibold text-white">Domain Tags</h2>

          {/* Add tag */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Add Domain Tag</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="example.com"
                value={newTagDomain}
                onChange={e => setNewTagDomain(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
              />
              <select
                value={newTagCategory}
                onChange={e => setNewTagCategory(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button
                onClick={handleAddTag}
                disabled={!newTagDomain.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setTagFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tagFilter === cat
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'All' : CATEGORIES[cat]?.label || cat}
                {cat !== 'all' && (
                  <span className="ml-1 text-slate-500">
                    ({domainTags.filter(t => t.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tag list */}
          <div className="space-y-1">
            {filtered.map(tag => (
              <div
                key={tag.id}
                className="flex items-center gap-3 px-4 py-2.5 bg-slate-800/30 border border-slate-700/50 rounded-lg group"
              >
                <span className="text-sm text-slate-200 font-mono flex-1">{tag.domain}</span>
                <Badge category={tag.category} />
                <span className="text-xs text-slate-600">{tag.source}</span>
                {tag.source === 'user' && (
                  <button
                    onClick={() => handleDeleteTag(tag.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No tags in this category</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {renderSidebar()}

      {/* Error toast */}
      {error && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-fade-in max-w-md">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300"><X size={14} /></button>
        </div>
      )}

      {currentView === 'dashboard' && renderDashboard()}
      {currentView === 'client' && renderClientView()}
      {currentView === 'domain-tags' && renderDomainTags()}
    </div>
  );
};

// ============================================================
// SUB-COMPONENTS (still in this file, per design decision)
// ============================================================

const DashboardClientCard = ({ client, onClick }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.getClientStats(client.id).then(setStats).catch(console.error);
  }, [client.id]);

  return (
    <button
      onClick={onClick}
      className="text-left bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 rounded-xl p-5 transition-colors"
    >
      <h3 className="text-lg font-medium text-white mb-3">{client.name}</h3>
      {stats ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500">Runs</p>
            <p className="text-lg font-semibold text-white">{stats.totalRuns}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Citations</p>
            <p className="text-lg font-semibold text-white">{stats.totalCitations}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Owned</p>
            <p className="text-lg font-semibold text-green-400">{stats.totalOwnedCitations}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Cost</p>
            <p className="text-lg font-semibold text-amber-400">${stats.totalCost?.toFixed(4)}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Loading...</p>
      )}
    </button>
  );
};

const ResultCard = ({ result, expanded, onToggle, onTag }) => {
  if (result.error) {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
        <p className="text-sm text-red-400">{result.query}: {result.error}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-800/60 transition-colors"
      >
        {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        <span className="flex-1 text-sm font-medium text-white">{result.query}</span>
        <span className="text-xs text-slate-400">{result.citationCount} citations</span>
        <span className="text-xs text-green-400">{result.ownedCitationCount} owned</span>
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-1 animate-fade-in border-t border-slate-700/30 pt-3">
          {(result.citations || []).map((c, i) => (
            <CitationRow key={i} citation={c} onTag={onTag} />
          ))}
          {(!result.citations || result.citations.length === 0) && (
            <p className="text-sm text-slate-500 py-2">No citations returned</p>
          )}
        </div>
      )}
    </div>
  );
};

const CitationRow = ({ citation, onTag }) => {
  const [showTagPicker, setShowTagPicker] = useState(false);
  const cat = CATEGORIES[citation.category] || CATEGORIES.unknown;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-slate-900/50 rounded-lg group text-sm">
      <span className="text-slate-500 w-5 text-right shrink-0">{citation.position}.</span>
      <Badge category={citation.category} />
      <span className="text-slate-300 font-mono text-xs truncate flex-1">{citation.domain}</span>

      {citation.category === 'unknown' && !showTagPicker && (
        <button
          onClick={() => setShowTagPicker(true)}
          className="opacity-0 group-hover:opacity-100 text-xs text-blue-400 hover:text-blue-300 transition-all"
        >
          Tag
        </button>
      )}

      {showTagPicker && (
        <div className="flex items-center gap-2 animate-fade-in">
          {CATEGORY_OPTIONS.slice(0, 6).map(opt => (
            <button
              key={opt.value}
              onClick={() => { onTag(citation.domain, opt.value); setShowTagPicker(false); }}
              className="px-2 py-0.5 rounded text-xs hover:bg-slate-700 transition-colors"
              style={{ color: CATEGORIES[opt.value]?.color }}
            >
              {opt.label}
            </button>
          ))}
          <button onClick={() => setShowTagPicker(false)} className="text-slate-500 hover:text-white">
            <X size={12} />
          </button>
        </div>
      )}

      <a
        href={citation.url}
        target="_blank"
        rel="noopener noreferrer"
        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-all"
      >
        <ExternalLink size={14} />
      </a>
    </div>
  );
};

export default App;
