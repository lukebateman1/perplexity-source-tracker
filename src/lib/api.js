const BASE = '/api';

async function request(path, options = {}) {
  const { headers: customHeaders, ...rest } = options;
  const hasBody = rest.method && rest.method !== 'GET' && rest.method !== 'DELETE';

  const headers = { ...customHeaders };
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.details || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Clients
export const getClients = () => request('/clients');
export const createClient = (name, owned_domains = []) =>
  request('/clients', { method: 'POST', body: JSON.stringify({ name, owned_domains }) });
export const updateClient = (id, data) =>
  request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteClient = (id) =>
  request(`/clients/${id}`, { method: 'DELETE' });

// Queries
export const getClientQueries = (clientId) => request(`/clients/${clientId}/queries`);
export const addQueries = (clientId, queries) =>
  request(`/clients/${clientId}/queries`, { method: 'POST', body: JSON.stringify({ queries }) });
export const deleteQuery = (id) =>
  request(`/queries/${id}`, { method: 'DELETE' });

// Analyze
export const analyzeQuery = (queryId, query, apiKey, model = 'sonar') =>
  request('/analyze', { method: 'POST', body: JSON.stringify({ queryId, query, apiKey, model }) });
export const analyzeBatch = (queryIds, apiKey, model = 'sonar') =>
  request('/analyze/batch', { method: 'POST', body: JSON.stringify({ queryIds, apiKey, model }) });

// Runs & Citations
export const getQueryRuns = (queryId) => request(`/queries/${queryId}/runs`);
export const getRunCitations = (runId) => request(`/runs/${runId}/citations`);

// Client History & Stats
export const getClientHistory = (clientId) => request(`/clients/${clientId}/history`);
export const getClientStats = (clientId) => request(`/clients/${clientId}/stats`);

// Domain Tags
export const getDomainTags = () => request('/domain-tags');
export const addDomainTag = (domain, category) =>
  request('/domain-tags', { method: 'POST', body: JSON.stringify({ domain, category }) });
export const deleteDomainTag = (id) =>
  request(`/domain-tags/${id}`, { method: 'DELETE' });

// Cost Estimate
export const getCostEstimate = (model, queryCount) =>
  request('/cost-estimate', { method: 'POST', body: JSON.stringify({ model, queryCount }) });

// Health
export const healthCheck = () => request('/health');
