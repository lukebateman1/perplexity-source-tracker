# Perplexity Source Tracker

Track which sources Perplexity cites for any query. Understand what content drives AI visibility.

## Features

- Query Perplexity and see all cited sources
- Automatic categorization: Owned, News, Exchange, Video, Social, Unknown
- Visual breakdown with charts
- Insights on source distribution
- Expandable domain taxonomy

## Local Development

```bash
# Install dependencies
npm install

# Run both frontend and backend in dev mode
npm run dev
```

Frontend runs on http://localhost:5173
Backend runs on http://localhost:3001

## Deploy to Railway

### Option 1: Via GitHub

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Railway auto-detects Node.js and deploys

### Option 2: Via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Build Settings (Railway will auto-detect, but if needed):

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Watch Paths:** `/`

## Environment Variables

No server-side env vars required. API keys are entered by users in the UI.

## Project Structure

```
/perplexity-source-tracker
├── server.js           # Express backend (API proxy)
├── src/
│   ├── App.jsx         # React frontend
│   ├── main.jsx        # React entry point
│   └── index.css       # Tailwind styles
├── index.html          # HTML entry
├── vite.config.js      # Vite config with proxy
├── tailwind.config.js  # Tailwind config
└── package.json        # Dependencies & scripts
```

## Expanding the Domain Taxonomy

Edit `DOMAIN_CATEGORIES` in `src/App.jsx` to add more domain → category mappings:

```javascript
const DOMAIN_CATEGORIES = {
  'newsite.com': 'news',
  'exchange.io': 'exchange',
  // ... add more
};
```

## Future Enhancements

- [ ] Persistent storage for historical tracking
- [ ] Multi-query batch analysis
- [ ] CSV/PDF export
- [ ] Competitor comparison view
- [ ] Multi-LLM support (ChatGPT, Claude, Gemini)
