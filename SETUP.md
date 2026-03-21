# 🚀 SETUP GUIDE — Galactica Lending Bot

## ✅ Project Status
- **TypeScript**: ✅ All types validated
- **Dependencies**: ✅ Installed
- **Build**: ✅ Production ready
- **Configuration**: ✅ Ready

---

## 📋 Prerequisites

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Git**: For version control
- **Environment Variables**: See `.env.example`

---

## 🔧 Installation & Setup

### 1. **Install Dependencies**
```bash
npm install
```

### 2. **Configure Environment**

Copy `.env.example` to `.env.local` and update with your values:

```bash
# Copy the configuration file
cp .env.example .env.local
```

**Required variables:**
```
OPENAI_API_KEY=sk-...
WDK_API_KEY=your_key
WDK_API_SECRET=your_secret
INTERCOM_API_KEY=your_key
AGENT_WALLET_PRIVATE_KEY=your_wif
```

### 3. **Type Check**
```bash
npm run type-check
```

### 4. **Build Project**
```bash
npm run build
```

---

## 🎯 Running the Application

### **Development Mode**
```bash
npm run dev
```
- Opens at `http://localhost:3000`
- Hot-reload enabled
- API routes available at `/api/*`

### **Production Mode**
```bash
npm run build
npm start
```

### **Agent Loop (Server-side Background Process)**
```bash
npm run agent:start
```
Runs the autonomous lending agent that:
- Monitors loan requests
- Scores borrowers
- Negotiates APR
- Executes settlements

### **Repayment Watcher (Cron Job)**
```bash
npm run agent:watcher
```
Monitors blockchain for repayment transactions every 5 minutes.

---

## 🧪 API Endpoints

### Authentication
```bash
# Request challenge
POST /api/auth/challenge
Body: { btcAddress: "1A..." }

# Verify signature
POST /api/auth/verify  
Body: { challenge: "...", signature: "...", btcAddress: "1A..." }
```

### Lending Flow
```bash
# Get loan balance for borrower
GET /api/loans?address=1A...

# Get agent wallet balance
GET /api/wallet/balance

# Negotiate terms (LLM-driven)
POST /api/agent/negotiate
Body: { sessionId, userMessage, amount, token }

# Execute loan settlement
POST /api/agent/execute
Body: { sessionId, confirm: true }
```

---

## 📊 Project Structure

```
galactica-lending-bot/
├── src/
│   ├── app/              # Next.js App Router pages & layout
│   ├── api/              # API Route handlers (/api/*)
│   ├── core/             # AgentLoop.ts — Main agent logic
│   ├── auth/             # Bitcoin identity verification
│   ├── data/             # IntercomProvider, API integrations
│   ├── db/               # LocalStore, persistence layer
│   ├── lifecycle/        # Cron jobs, monitoring
│   ├── logic/            # Business logic (Negotiator, Scoring)
│   ├── types/            # TypeScript interfaces
│   ├── ui/               # React components
│   ├── utils/            # Helpers, logger
│   └── wallet/           # WDK client (Tether settlements)
├── data/                 # Database files (loans.json, blacklist.json)
├── public/               # Static files
├── .env.example          # Environment template
├── .env.local            # Local configuration (DO NOT COMMIT)
├── tsconfig.json         # TypeScript config (client)
├── tsconfig.server.json  # TypeScript config (server/agent)
├── next.config.js        # Next.js configuration
└── package.json          # Dependencies
```

---

## 🔍 Verification Checklist

- [x] TypeScript compilation passes
- [x] All dependencies resolved
- [x] API routes configured
- [x] Type definitions complete
- [x] Environment template ready
- [x] Build process successful
- [x] No circular dependencies
- [x] Error handling implemented

---

## 🐛 Troubleshooting

### Build fails with TypeScript errors
```bash
npm run type-check
# Review errors and fix types
```

### Dependencies missing
```bash
npm install --legacy-peer-deps
# Or use npm ci for exact versions
```

### Port 3000 already in use
```bash
npm run dev -- -p 3001
```

### Environment variables not loading
- Ensure `.env.local` exists in project root
- Restart dev server after changes
- Check variable names match exactly

---

## 📦 Key Dependencies

| Package | Purpose |
|---------|---------|
| next | Framework & routing |
| typescript | Type safety |
| bitcoinjs-message | Bitcoin identity verification |
| openai | LLM (GPT-4o) for negotiations |
| axios | HTTP requests |
| lowdb | Local JSON database |
| node-cron | Background tasks |
| ws | WebSocket support |
| tailwindcss | UI styling |

---

## 🚀 Deployment

### Vercel (Recommended)
```bash
vercel deploy
```

### Docker
```bash
docker build -t galactica-bot .
docker run -p 3000:3000 -e OPENAI_API_KEY=sk-... galactica-bot
```

### Self-hosted
```bash
npm run build
npm start
```

---

## 📚 Documentation

- [README.md](README.md) — Architecture & features
- [.env.example](.env.example) — All configuration options
- `src/types/index.ts` — Type definitions
- `src/core/AgentLoop.ts` — Agent main logic

---

## 🤝 Support

For issues or questions:
1. Check the ERROR logs: `npm run dev` → browser console
2. Review `.env.local` configuration
3. Verify API keys and permissions
4. Check agent logs at `src/utils/logger.ts`

---

**Last updated**: March 21, 2026  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
