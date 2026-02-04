import React, { useState } from 'react';
import { Search, ExternalLink, Globe, Newspaper, TrendingUp, Play, Users, HelpCircle, Sparkles, ArrowRight, BarChart3, Link2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// Category configuration with colors and icons
const CATEGORIES = {
  owned: { label: 'Owned', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', icon: Globe },
  news: { label: 'News', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', icon: Newspaper },
  exchange: { label: 'Exchange', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', icon: TrendingUp },
  video: { label: 'Video', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', icon: Play },
  social: { label: 'Social', color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.15)', icon: Users },
  unknown: { label: 'Unknown', color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', icon: HelpCircle },
};

// Domain to category mapping (expandable)
const DOMAIN_CATEGORIES = {
  // News
  'coindesk.com': 'news',
  'cointelegraph.com': 'news',
  'decrypt.co': 'news',
  'theblock.co': 'news',
  'forbes.com': 'news',
  'bloomberg.com': 'news',
  'reuters.com': 'news',
  'wsj.com': 'news',
  'nytimes.com': 'news',
  'theguardian.com': 'news',
  'techcrunch.com': 'news',
  'wired.com': 'news',
  'arstechnica.com': 'news',
  'beincrypto.com': 'news',
  'coti.news': 'news',
  'intersectmbo.org': 'news',
  'cryptoslate.com': 'news',
  'bitcoinmagazine.com': 'news',
  'blockworks.co': 'news',
  // Exchanges
  'binance.com': 'exchange',
  'coinbase.com': 'exchange',
  'kraken.com': 'exchange',
  'coinmarketcap.com': 'exchange',
  'coingecko.com': 'exchange',
  'cryptocompare.com': 'exchange',
  'messari.io': 'exchange',
  // Video
  'youtube.com': 'video',
  'youtu.be': 'video',
  'vimeo.com': 'video',
  'twitch.tv': 'video',
  // Social
  'twitter.com': 'social',
  'x.com': 'social',
  'reddit.com': 'social',
  'linkedin.com': 'social',
  'medium.com': 'social',
  'discord.com': 'social',
  'telegram.org': 'social',
  't.me': 'social',
  'github.com': 'social',
  'stackoverflow.com': 'social',
};

const App = () => {
  const [view, setView] = useState('input'); // 'input' | 'loading' | 'results'
  const [query, setQuery] = useState('');
  const [ownedDomains, setOwnedDomains] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loadingStep, setLoadingStep] = useState('');

  const extractDomain = (url) => {
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      return hostname;
    } catch {
      return url;
    }
  };

  const getBaseDomain = (domain) => {
    const parts = domain.split('.');
    if (parts.length > 2) {
      return parts.slice(-2).join('.');
    }
    return domain;
  };

  const categorizeSource = (url, ownedList) => {
    const domain = extractDomain(url);
    const baseDomain = getBaseDomain(domain);
    
    // Check if owned (including subdomains)
    for (const owned of ownedList) {
      const ownedClean = owned.trim().toLowerCase().replace('www.', '');
      if (domain.includes(ownedClean) || ownedClean.includes(baseDomain)) {
        return 'owned';
      }
    }
    
    // Check master list
    if (DOMAIN_CATEGORIES[domain]) return DOMAIN_CATEGORIES[domain];
    if (DOMAIN_CATEGORIES[baseDomain]) return DOMAIN_CATEGORIES[baseDomain];
    
    return 'unknown';
  };

  const parsePerplexityResponse = (response, ownedList) => {
    const citations = response.citations || [];
    const sources = citations.map((url, index) => ({
      id: index + 1,
      url,
      domain: extractDomain(url),
      category: categorizeSource(url, ownedList),
    }));

    // Calculate breakdown
    const breakdown = {};
    sources.forEach(s => {
      breakdown[s.category] = (breakdown[s.category] || 0) + 1;
    });

    const chartData = Object.entries(breakdown).map(([category, count]) => ({
      name: CATEGORIES[category].label,
      value: count,
      category,
      percentage: ((count / sources.length) * 100).toFixed(1),
    }));

    // Generate insights
    const insights = [];
    const ownedCount = breakdown.owned || 0;
    const ownedPct = sources.length > 0 ? ((ownedCount / sources.length) * 100).toFixed(0) : 0;
    
    if (ownedCount > 0) {
      insights.push({
        type: 'success',
        text: `${ownedCount} of ${sources.length} citations (${ownedPct}%) are from your owned properties.`
      });
    } else {
      insights.push({
        type: 'warning',
        text: `No owned sources cited. Perplexity is pulling entirely from third-party content.`
      });
    }

    const newsCount = breakdown.news || 0;
    if (newsCount > 0) {
      insights.push({
        type: 'info',
        text: `${newsCount} news sources cited. PR and media coverage influences AI answers for this query.`
      });
    }

    const socialCount = breakdown.social || 0;
    if (socialCount > 0) {
      insights.push({
        type: 'info',
        text: `${socialCount} social/community sources cited. User-generated content is shaping AI perception.`
      });
    }

    const unknownCount = breakdown.unknown || 0;
    if (unknownCount > 0) {
      insights.push({
        type: 'neutral',
        text: `${unknownCount} unknown sources need categorization for better tracking.`
      });
    }

    return {
      query: response.query,
      answer: response.choices?.[0]?.message?.content || '',
      sources,
      breakdown,
      chartData,
      insights,
      timestamp: new Date().toISOString(),
    };
  };

  const runAnalysis = async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }
    if (!apiKey.trim()) {
      setError('Please enter your Perplexity API key');
      return;
    }

    setError(null);
    setView('loading');
    setLoadingStep('Connecting to Perplexity...');

    const ownedList = ownedDomains
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(d => d);

    try {
      setLoadingStep('Sending query...');
      
      // Call our backend proxy instead of Perplexity directly
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, apiKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      setLoadingStep('Parsing citations...');
      const data = await response.json();
      
      setLoadingStep('Categorizing sources...');
      await new Promise(r => setTimeout(r, 400)); // Brief pause for UX
      
      const parsed = parsePerplexityResponse(data, ownedList);
      parsed.query = query;
      
      setResults(parsed);
      setView('results');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message);
      setView('input');
    }
  };

  const resetToInput = () => {
    setView('input');
    setResults(null);
    setError(null);
  };

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg shadow-xl">
          <p className="text-white font-medium">{data.name}</p>
          <p className="text-slate-400 text-sm">{data.value} sources ({data.percentage}%)</p>
        </div>
      );
    }
    return null;
  };

  // ========== INPUT VIEW ==========
  if (view === 'input') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Subtle grid background */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
        
        <div className="relative z-10 max-w-2xl mx-auto px-6 py-20">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-full text-xs text-slate-400 mb-6">
              <Sparkles size={12} className="text-amber-500" />
              AI Source Intelligence
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              <span className="text-white">Perplexity</span>
              <span className="text-slate-500 ml-2">Source Tracker</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-md mx-auto">
              See which sources Perplexity cites for any query. Understand what content drives AI visibility.
            </p>
          </div>

          {/* Input Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
            {/* API Key */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Perplexity API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="pplx-..."
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
              <p className="mt-2 text-xs text-slate-500">
                Get your key at perplexity.ai/settings/api
              </p>
            </div>

            {/* Query */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Query
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What is Midnight Network?"
                  className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                />
              </div>
            </div>

            {/* Owned Domains */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Owned Domains
                <span className="text-slate-500 font-normal ml-2">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={ownedDomains}
                onChange={(e) => setOwnedDomains(e.target.value)}
                placeholder="midnight.network, docs.midnight.network"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
              <p className="mt-2 text-xs text-slate-500">
                Subdomains are matched automatically
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={runAnalysis}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 group"
            >
              Analyze Sources
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Example queries */}
          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm mb-3">Try these:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Best crypto developer ecosystem?', 'What is Cardano?', 'Top privacy blockchains 2025'].map((q) => (
                <button
                  key={q}
                  onClick={() => setQuery(q)}
                  className="px-3 py-1.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-sm text-slate-400 hover:text-white transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== LOADING VIEW ==========
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="w-20 h-20 border-4 border-slate-800 rounded-full" />
            <div className="absolute inset-0 w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Analyzing Sources</h2>
          <p className="text-slate-400">{loadingStep}</p>
        </div>
      </div>
    );
  }

  // ========== RESULTS VIEW ==========
  if (view === 'results' && results) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <button
                onClick={resetToInput}
                className="text-slate-400 hover:text-white text-sm mb-2 flex items-center gap-1 transition-colors"
              >
                ← New query
              </button>
              <h1 className="text-2xl font-bold text-white">Source Analysis</h1>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-sm">Query</p>
              <p className="text-white font-medium">{results.query}</p>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Chart Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-slate-400" />
                <h2 className="font-semibold text-white">Source Breakdown</h2>
              </div>
              
              {results.chartData.length > 0 ? (
                <>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={results.chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {results.chartData.map((entry) => (
                            <Cell 
                              key={entry.category} 
                              fill={CATEGORIES[entry.category].color}
                              stroke="transparent"
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Legend */}
                  <div className="space-y-2 mt-4">
                    {results.chartData.map((item) => {
                      const cat = CATEGORIES[item.category];
                      return (
                        <div key={item.category} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-sm text-slate-300">{cat.label}</span>
                          </div>
                          <span className="text-sm text-slate-400">
                            {item.value} ({item.percentage}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-slate-500 text-center py-8">No sources found</p>
              )}
            </div>

            {/* Insights Card */}
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-amber-500" />
                <h2 className="font-semibold text-white">Insights</h2>
              </div>
              
              <div className="space-y-3 mb-6">
                {results.insights.map((insight, i) => {
                  const colors = {
                    success: 'bg-green-500/10 border-green-500/30 text-green-400',
                    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
                    neutral: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
                  };
                  return (
                    <div 
                      key={i}
                      className={`px-4 py-3 rounded-xl border ${colors[insight.type]}`}
                    >
                      {insight.text}
                    </div>
                  );
                })}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-white">{results.sources.length}</p>
                  <p className="text-sm text-slate-400">Total Sources</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-400">
                    {results.breakdown.owned || 0}
                  </p>
                  <p className="text-sm text-slate-400">Owned</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-slate-400">
                    {Object.keys(results.breakdown).length}
                  </p>
                  <p className="text-sm text-slate-400">Categories</p>
                </div>
              </div>
            </div>
          </div>

          {/* Citations List */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Link2 size={18} className="text-slate-400" />
              <h2 className="font-semibold text-white">All Citations</h2>
              <span className="text-slate-500 text-sm ml-2">({results.sources.length})</span>
            </div>
            
            {results.sources.length > 0 ? (
              <div className="space-y-2">
                {results.sources.map((source) => {
                  const cat = CATEGORIES[source.category];
                  const IconComponent = cat.icon;
                  return (
                    <div 
                      key={source.id}
                      className="flex items-center gap-4 px-4 py-3 bg-slate-800/40 hover:bg-slate-800/60 rounded-xl transition-colors group"
                    >
                      <span className="text-slate-500 text-sm w-6">{source.id}.</span>
                      <div 
                        className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0"
                        style={{ 
                          backgroundColor: cat.bgColor,
                          color: cat.color 
                        }}
                      >
                        <IconComponent size={12} />
                        {cat.label}
                      </div>
                      <span className="text-slate-300 truncate flex-1">
                        {source.domain}
                      </span>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No citations returned from Perplexity</p>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-slate-500 text-sm">
            Analyzed at {new Date(results.timestamp).toLocaleString()}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default App;
