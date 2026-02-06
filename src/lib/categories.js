import {
  Globe, Newspaper, TrendingUp, Play, Users, HelpCircle,
  Code, BookOpen, Rss, FileText
} from 'lucide-react';

// Category configuration — colors, labels, icons
export const CATEGORIES = {
  owned:      { label: 'Owned',      color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)',  icon: Globe },
  news:       { label: 'News',       color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', icon: Newspaper },
  exchange:   { label: 'Exchange',   color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', icon: TrendingUp },
  video:      { label: 'Video',      color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)',  icon: Play },
  social:     { label: 'Social',     color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.15)', icon: Users },
  developer:  { label: 'Developer',  color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.15)',  icon: Code },
  reference:  { label: 'Reference',  color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)', icon: BookOpen },
  aggregator: { label: 'Aggregator', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)', icon: Rss },
  blog:       { label: 'Blog',       color: '#14b8a6', bgColor: 'rgba(20, 184, 166, 0.15)', icon: FileText },
  unknown:    { label: 'Unknown',    color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', icon: HelpCircle },
};

// All category keys for dropdowns
export const CATEGORY_OPTIONS = Object.entries(CATEGORIES)
  .filter(([key]) => key !== 'owned') // owned is auto-detected, not manually assigned
  .map(([key, val]) => ({ value: key, label: val.label }));

// Pattern-based category suggestion (not auto-applied — for UI hints)
export function suggestCategory(domain, url = '') {
  const d = domain.toLowerCase();
  const u = url.toLowerCase();

  // TLD-based hints (only strong signals — .io is too ambiguous)
  if (d.endsWith('.news')) return 'news';
  if (d.endsWith('.dev')) return 'developer';
  if (d.endsWith('.edu')) return 'reference';
  if (d.endsWith('.gov')) return 'reference';

  // URL path hints
  if (u.includes('/blog/') || u.includes('/blog.')) return 'blog';
  if (u.includes('/article/') || u.includes('/articles/')) return 'news';
  if (u.includes('/docs/') || u.includes('/documentation/')) return 'developer';
  if (u.includes('/wiki/')) return 'reference';
  if (u.includes('/video/') || u.includes('/watch')) return 'video';

  // Domain keyword hints
  if (d.includes('news') || d.includes('journal') || d.includes('times') || d.includes('post')) return 'news';
  if (d.includes('exchange') || d.includes('swap') || d.includes('dex') || d.includes('trade')) return 'exchange';
  if (d.includes('blog')) return 'blog';
  if (d.includes('wiki') || d.includes('pedia')) return 'reference';
  if (d.includes('forum') || d.includes('community')) return 'social';

  return null; // no suggestion
}

// Model pricing for cost estimation UI
export const MODEL_PRICING = {
  'sonar':               { label: 'Sonar',               input: 1.00, output: 1.00 },
  'sonar-pro':           { label: 'Sonar Pro',           input: 3.00, output: 15.00 },
  'sonar-reasoning':     { label: 'Sonar Reasoning',     input: 1.00, output: 5.00 },
  'sonar-reasoning-pro': { label: 'Sonar Reasoning Pro', input: 2.00, output: 8.00 },
};

export const MODEL_OPTIONS = Object.entries(MODEL_PRICING).map(([key, val]) => ({
  value: key,
  label: val.label,
}));

export function estimateCostClient(model, queryCount = 1) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['sonar'];
  const avgInputTokens = 200;
  const avgOutputTokens = 500;
  const costPerQuery = (avgInputTokens / 1_000_000 * pricing.input) + (avgOutputTokens / 1_000_000 * pricing.output);
  return +(costPerQuery * queryCount).toFixed(6);
}
