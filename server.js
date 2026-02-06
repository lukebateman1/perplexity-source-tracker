import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import db from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================================
// HELPERS
// ============================================================

// Convert snake_case DB rows to camelCase for consistent API responses
const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const camelKeys = (obj) => {
  if (Array.isArray(obj)) return obj.map(camelKeys);
  if (obj === null || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [toCamel(k), v])
  );
};

const extractDomain = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// Compound TLDs where the last two parts are the TLD, not the domain
const COMPOUND_TLDS = new Set([
  'co.uk', 'co.jp', 'co.kr', 'co.nz', 'co.za', 'co.in', 'co.id',
  'com.au', 'com.br', 'com.cn', 'com.mx', 'com.sg', 'com.tw', 'com.hk',
  'org.uk', 'net.au', 'ac.uk', 'gov.uk',
]);

const getParentDomain = (domain) => {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;

  // Check if last two parts form a compound TLD
  const lastTwo = parts.slice(-2).join('.');
  if (COMPOUND_TLDS.has(lastTwo) && parts.length > 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
};

const categorizeDomain = (domain, ownedDomains = []) => {
  // 1. Check owned domains (including subdomain matching)
  for (const owned of ownedDomains) {
    const ownedClean = owned.trim().toLowerCase().replace(/^www\./, '');
    if (domain === ownedClean || domain.endsWith('.' + ownedClean)) {
      return 'owned';
    }
  }

  // 2. Check domain_tags table (exact match)
  const exactTag = db.prepare('SELECT category FROM domain_tags WHERE domain = ?').get(domain);
  if (exactTag) return exactTag.category;

  // 3. Check parent domain
  const parentDomain = getParentDomain(domain);
  if (parentDomain !== domain) {
    const parentTag = db.prepare('SELECT category FROM domain_tags WHERE domain = ?').get(parentDomain);
    if (parentTag) return parentTag.category;
  }

  // 4. Fallback
  return 'unknown';
};

// Model pricing per million tokens
const MODEL_PRICING = {
  'sonar': { input: 1.00, output: 1.00 },
  'sonar-pro': { input: 3.00, output: 15.00 },
  'sonar-reasoning': { input: 1.00, output: 5.00 },
  'sonar-reasoning-pro': { input: 2.00, output: 8.00 },
};

const estimateCost = (model, queryCount = 1) => {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['sonar'];
  const avgInputTokens = 200;
  const avgOutputTokens = 500;
  const costPerQuery = (avgInputTokens / 1_000_000 * pricing.input) + (avgOutputTokens / 1_000_000 * pricing.output);
  return +(costPerQuery * queryCount).toFixed(6);
};

// ============================================================
// CLIENTS
// ============================================================

app.get('/api/clients', (req, res) => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
  res.json(clients.map(c => camelKeys({ ...c, owned_domains: JSON.parse(c.owned_domains) })));
});

app.post('/api/clients', (req, res) => {
  const { name, owned_domains = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Client name is required' });

  const result = db.prepare(
    'INSERT INTO clients (name, owned_domains) VALUES (?, ?)'
  ).run(name.trim(), JSON.stringify(owned_domains));

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(camelKeys({ ...client, owned_domains: JSON.parse(client.owned_domains) }));
});

app.put('/api/clients/:id', (req, res) => {
  const { name, owned_domains } = req.body;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  db.prepare(
    "UPDATE clients SET name = ?, owned_domains = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(
    name?.trim() || client.name,
    owned_domains ? JSON.stringify(owned_domains) : client.owned_domains,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  res.json(camelKeys({ ...updated, owned_domains: JSON.parse(updated.owned_domains) }));
});

app.delete('/api/clients/:id', (req, res) => {
  const result = db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Client not found' });
  res.json({ success: true });
});

// ============================================================
// QUERIES
// ============================================================

app.get('/api/clients/:id/queries', (req, res) => {
  const queries = db.prepare(`
    SELECT q.*,
      COUNT(r.id) as run_count,
      MAX(r.created_at) as last_run
    FROM queries q
    LEFT JOIN runs r ON r.query_id = q.id
    WHERE q.client_id = ?
    GROUP BY q.id
    ORDER BY q.created_at DESC
  `).all(req.params.id);
  res.json(camelKeys(queries));
});

app.post('/api/clients/:id/queries', (req, res) => {
  const { queries } = req.body;
  if (!Array.isArray(queries) || queries.length === 0) {
    return res.status(400).json({ error: 'Queries array is required' });
  }

  const insert = db.prepare('INSERT INTO queries (client_id, query_text) VALUES (?, ?)');
  const insertMany = db.transaction((items) => {
    const results = [];
    for (const text of items) {
      if (text.trim()) {
        const result = insert.run(req.params.id, text.trim());
        results.push(result.lastInsertRowid);
      }
    }
    return results;
  });

  const ids = insertMany(queries);
  if (ids.length === 0) {
    return res.status(400).json({ error: 'No valid queries provided (all were empty)' });
  }
  const created = db.prepare(`SELECT * FROM queries WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  res.status(201).json(camelKeys(created));
});

app.delete('/api/queries/:id', (req, res) => {
  const result = db.prepare('DELETE FROM queries WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Query not found' });
  res.json({ success: true });
});

// ============================================================
// ANALYZE — Single query
// ============================================================

app.post('/api/analyze', async (req, res) => {
  const { queryId, query, apiKey, model = 'sonar' } = req.body;

  if (!query) return res.status(400).json({ error: 'Query is required' });
  if (!apiKey) return res.status(400).json({ error: 'API key is required' });

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: query }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      return res.status(response.status).json({
        error: `Perplexity API error: ${response.status}`,
        details: errorText,
      });
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    const cost = estimateCost(model, 1);

    // Get client's owned domains if queryId provided
    let ownedDomains = [];
    if (queryId) {
      const queryRow = db.prepare(`
        SELECT c.owned_domains FROM queries q
        JOIN clients c ON c.id = q.client_id
        WHERE q.id = ?
      `).get(queryId);
      if (queryRow) ownedDomains = JSON.parse(queryRow.owned_domains);
    }

    // Categorize and count
    const categorizedCitations = citations.map((url, i) => {
      const domain = extractDomain(url);
      const category = categorizeDomain(domain, ownedDomains);
      return { url, domain, position: i + 1, category };
    });

    const ownedCount = categorizedCitations.filter(c => c.category === 'owned').length;

    // Store run if queryId provided
    let runId = null;
    if (queryId) {
      const runResult = db.prepare(`
        INSERT INTO runs (query_id, raw_response, response_text, model, cost_estimate, citation_count, owned_citation_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(queryId, JSON.stringify(data), responseText, model, cost, citations.length, ownedCount);

      runId = runResult.lastInsertRowid;

      const insertCitation = db.prepare(`
        INSERT INTO citations (run_id, url, domain, position, category) VALUES (?, ?, ?, ?, ?)
      `);
      const insertAll = db.transaction((items) => {
        for (const c of items) {
          insertCitation.run(runId, c.url, c.domain, c.position, c.category);
        }
      });
      insertAll(categorizedCitations);
    }

    res.json({
      runId,
      responseText,
      citations: categorizedCitations,
      citationCount: citations.length,
      ownedCitationCount: ownedCount,
      model,
      costEstimate: cost,
      raw: data,
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Failed to query Perplexity', details: error.message });
  }
});

// ============================================================
// ANALYZE — Batch (sequential with delay)
// ============================================================

app.post('/api/analyze/batch', async (req, res) => {
  const { queryIds, apiKey, model = 'sonar' } = req.body;

  if (!Array.isArray(queryIds) || queryIds.length === 0) {
    return res.status(400).json({ error: 'queryIds array is required' });
  }
  if (!apiKey) return res.status(400).json({ error: 'API key is required' });

  const results = [];

  for (let i = 0; i < queryIds.length; i++) {
    const queryRow = db.prepare('SELECT * FROM queries WHERE id = ?').get(queryIds[i]);
    if (!queryRow) {
      results.push({ queryId: queryIds[i], error: 'Query not found' });
      continue;
    }

    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: queryRow.query_text }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        results.push({ queryId: queryIds[i], query: queryRow.query_text, error: `API error: ${response.status}`, details: errorText });
        continue;
      }

      const data = await response.json();
      const responseText = data.choices?.[0]?.message?.content || '';
      const citations = data.citations || [];
      const cost = estimateCost(model, 1);

      const clientRow = db.prepare('SELECT c.owned_domains FROM queries q JOIN clients c ON c.id = q.client_id WHERE q.id = ?').get(queryIds[i]);
      const ownedDomains = clientRow ? JSON.parse(clientRow.owned_domains) : [];

      const categorizedCitations = citations.map((url, idx) => {
        const domain = extractDomain(url);
        const category = categorizeDomain(domain, ownedDomains);
        return { url, domain, position: idx + 1, category };
      });

      const ownedCount = categorizedCitations.filter(c => c.category === 'owned').length;

      const runResult = db.prepare(`
        INSERT INTO runs (query_id, raw_response, response_text, model, cost_estimate, citation_count, owned_citation_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(queryIds[i], JSON.stringify(data), responseText, model, cost, citations.length, ownedCount);

      const runId = runResult.lastInsertRowid;

      const insertCitation = db.prepare('INSERT INTO citations (run_id, url, domain, position, category) VALUES (?, ?, ?, ?, ?)');
      db.transaction(() => {
        for (const c of categorizedCitations) {
          insertCitation.run(runId, c.url, c.domain, c.position, c.category);
        }
      })();

      results.push({
        queryId: queryIds[i],
        query: queryRow.query_text,
        runId,
        citationCount: citations.length,
        ownedCitationCount: ownedCount,
        costEstimate: cost,
        citations: categorizedCitations,
      });

      if (i < queryIds.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      results.push({ queryId: queryIds[i], query: queryRow.query_text, error: error.message });
    }
  }

  res.json({ results, totalCost: results.reduce((sum, r) => sum + (r.costEstimate || 0), 0) });
});

// ============================================================
// RUNS & CITATIONS
// ============================================================

app.get('/api/queries/:id/runs', (req, res) => {
  const runs = db.prepare('SELECT * FROM runs WHERE query_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(camelKeys(runs));
});

app.get('/api/runs/:id/citations', (req, res) => {
  const citations = db.prepare('SELECT * FROM citations WHERE run_id = ? ORDER BY position ASC').all(req.params.id);
  res.json(camelKeys(citations));
});

// ============================================================
// CLIENT HISTORY & STATS
// ============================================================

app.get('/api/clients/:id/history', (req, res) => {
  const runs = db.prepare(`
    SELECT r.*, q.query_text
    FROM runs r
    JOIN queries q ON q.id = r.query_id
    WHERE q.client_id = ?
    ORDER BY r.created_at DESC
  `).all(req.params.id);

  const getCitations = db.prepare('SELECT * FROM citations WHERE run_id = ? ORDER BY position ASC');
  const history = runs.map(run => camelKeys({
    ...run,
    citations: getCitations.all(run.id).map(c => camelKeys(c)),
  }));

  res.json(history);
});

app.get('/api/clients/:id/stats', (req, res) => {
  const clientId = req.params.id;

  const totals = db.prepare(`
    SELECT
      COUNT(DISTINCT r.id) as total_runs,
      COALESCE(SUM(r.citation_count), 0) as total_citations,
      COALESCE(SUM(r.owned_citation_count), 0) as total_owned_citations,
      COALESCE(SUM(r.cost_estimate), 0) as total_cost,
      COALESCE(AVG(r.citation_count), 0) as avg_citations_per_run
    FROM runs r
    JOIN queries q ON q.id = r.query_id
    WHERE q.client_id = ?
  `).get(clientId);

  const categoryBreakdown = db.prepare(`
    SELECT c.category, COUNT(*) as count
    FROM citations c
    JOIN runs r ON r.id = c.run_id
    JOIN queries q ON q.id = r.query_id
    WHERE q.client_id = ?
    GROUP BY c.category
    ORDER BY count DESC
  `).all(clientId);

  const topDomains = db.prepare(`
    SELECT c.domain, c.category, COUNT(*) as count
    FROM citations c
    JOIN runs r ON r.id = c.run_id
    JOIN queries q ON q.id = r.query_id
    WHERE q.client_id = ?
    GROUP BY c.domain
    ORDER BY count DESC
    LIMIT 15
  `).all(clientId);

  res.json(camelKeys({
    ...totals,
    total_cost: +totals.total_cost.toFixed(6),
    avg_citations_per_run: +totals.avg_citations_per_run.toFixed(1),
    category_breakdown: categoryBreakdown,
    top_domains: topDomains,
  }));
});

// ============================================================
// DOMAIN TAGS
// ============================================================

app.get('/api/domain-tags', (req, res) => {
  const tags = db.prepare('SELECT * FROM domain_tags ORDER BY category, domain').all();
  res.json(camelKeys(tags));
});

app.post('/api/domain-tags', (req, res) => {
  const { domain, category } = req.body;
  if (!domain?.trim() || !category?.trim()) {
    return res.status(400).json({ error: 'Domain and category are required' });
  }

  const cleanDomain = domain.trim().toLowerCase().replace(/^www\./, '');

  db.prepare(`
    INSERT INTO domain_tags (domain, category, source) VALUES (?, ?, 'user')
    ON CONFLICT(domain) DO UPDATE SET category = ?, source = 'user'
  `).run(cleanDomain, category, category);

  // Retroactively update existing 'unknown' citations
  const updated = db.prepare(`
    UPDATE citations SET category = ? WHERE domain = ? AND category = 'unknown'
  `).run(category, cleanDomain);

  const parentUpdated = db.prepare(`
    UPDATE citations SET category = ? WHERE domain LIKE ? AND category = 'unknown'
  `).run(category, `%.${cleanDomain}`);

  const tag = db.prepare('SELECT * FROM domain_tags WHERE domain = ?').get(cleanDomain);
  res.json({
    tag: camelKeys(tag),
    retroactiveUpdates: updated.changes + parentUpdated.changes,
  });
});

app.delete('/api/domain-tags/:id', (req, res) => {
  const tag = db.prepare('SELECT * FROM domain_tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: 'Tag not found' });
  if (tag.source === 'system') return res.status(403).json({ error: 'Cannot delete system tags' });

  db.prepare('DELETE FROM domain_tags WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============================================================
// COST ESTIMATE
// ============================================================

app.post('/api/cost-estimate', (req, res) => {
  const { model = 'sonar', queryCount = 1 } = req.body;
  const cost = estimateCost(model, queryCount);
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['sonar'];
  res.json({ model, queryCount, estimatedCost: cost, pricing });
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', (req, res) => {
  const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;
  const tagCount = db.prepare('SELECT COUNT(*) as count FROM domain_tags').get().count;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: { clients: clientCount, domainTags: tagCount },
  });
});

// ============================================================
// STATIC FILES & SPA FALLBACK
// ============================================================

app.use(express.static(join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
