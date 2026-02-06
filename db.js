import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DB_PATH || 'data/tracker.db';

// Ensure data directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read/write performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================
// SCHEMA
// ============================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owned_domains TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    query_text TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_id INTEGER NOT NULL,
    raw_response TEXT,
    response_text TEXT,
    model TEXT DEFAULT 'sonar',
    cost_estimate REAL DEFAULT 0,
    citation_count INTEGER DEFAULT 0,
    owned_citation_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS citations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    position INTEGER NOT NULL,
    context_snippet TEXT,
    category TEXT DEFAULT 'unknown',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS domain_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    source TEXT DEFAULT 'system',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ============================================================
// SEED DATA — System domain tags
// ============================================================

const SEED_DOMAINS = [
  // News
  ['coindesk.com', 'news'],
  ['cointelegraph.com', 'news'],
  ['decrypt.co', 'news'],
  ['theblock.co', 'news'],
  ['forbes.com', 'news'],
  ['bloomberg.com', 'news'],
  ['reuters.com', 'news'],
  ['wsj.com', 'news'],
  ['nytimes.com', 'news'],
  ['theguardian.com', 'news'],
  ['techcrunch.com', 'news'],
  ['wired.com', 'news'],
  ['arstechnica.com', 'news'],
  ['beincrypto.com', 'news'],
  ['cryptoslate.com', 'news'],
  ['bitcoinmagazine.com', 'news'],
  ['blockworks.co', 'news'],
  ['thedefiant.io', 'news'],
  ['cryptonews.com', 'news'],
  ['dailyhodl.com', 'news'],
  ['u.today', 'news'],
  ['newsbtc.com', 'news'],
  ['ambcrypto.com', 'news'],
  ['cryptopotato.com', 'news'],
  ['cnbc.com', 'news'],
  ['bbc.com', 'news'],
  ['apnews.com', 'news'],
  ['cnn.com', 'news'],
  ['theverge.com', 'news'],
  ['engadget.com', 'news'],
  ['zdnet.com', 'news'],
  ['venturebeat.com', 'news'],
  // Exchanges / Market Data
  ['binance.com', 'exchange'],
  ['coinbase.com', 'exchange'],
  ['kraken.com', 'exchange'],
  ['coinmarketcap.com', 'exchange'],
  ['coingecko.com', 'exchange'],
  ['cryptocompare.com', 'exchange'],
  ['messari.io', 'exchange'],
  ['dextools.io', 'exchange'],
  ['tradingview.com', 'exchange'],
  ['defillama.com', 'exchange'],
  ['dune.com', 'exchange'],
  ['etherscan.io', 'exchange'],
  ['cardanoscan.io', 'exchange'],
  ['blockchair.com', 'exchange'],
  // Video
  ['youtube.com', 'video'],
  ['youtu.be', 'video'],
  ['vimeo.com', 'video'],
  ['twitch.tv', 'video'],
  // Social
  ['twitter.com', 'social'],
  ['x.com', 'social'],
  ['reddit.com', 'social'],
  ['linkedin.com', 'social'],
  ['medium.com', 'social'],
  ['discord.com', 'social'],
  ['telegram.org', 'social'],
  ['t.me', 'social'],
  // Developer
  ['github.com', 'developer'],
  ['stackoverflow.com', 'developer'],
  ['docs.soliditylang.org', 'developer'],
  ['developer.mozilla.org', 'developer'],
  ['npmjs.com', 'developer'],
  // Reference
  ['wikipedia.org', 'reference'],
  ['investopedia.com', 'reference'],
  ['docs.google.com', 'reference'],
  ['arxiv.org', 'reference'],
  // Aggregator
  ['feedly.com', 'aggregator'],
  ['flipboard.com', 'aggregator'],
  ['news.ycombinator.com', 'aggregator'],
  // Blog
  ['substack.com', 'blog'],
  ['mirror.xyz', 'blog'],
  ['hashnode.dev', 'blog'],
  ['dev.to', 'blog'],
];

const insertSeed = db.prepare(`
  INSERT OR IGNORE INTO domain_tags (domain, category, source) VALUES (?, ?, 'system')
`);

const seedTransaction = db.transaction(() => {
  for (const [domain, category] of SEED_DOMAINS) {
    insertSeed.run(domain, category);
  }
});

seedTransaction();

console.log(`Database initialized at ${DB_PATH} with ${SEED_DOMAINS.length} seed domains`);

export default db;
