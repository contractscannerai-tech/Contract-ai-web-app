# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## App: ContractAI

A complete SaaS web application that lets users upload legal contracts (PDFs), analyze them with AI, and receive:
- Plain-English summaries
- Risk detection (low/medium/high)
- Key clause extraction
- AI chat assistant (Premium plan)

### Tagline
"Your contract analyzer in your pocket — without paying expensive lawyers."

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (artifacts/contract-ai)
- **Auth**: Supabase (email+password)
- **AI**: GROQ (llama-3.3-70b-versatile)
- **OCR**: ocr.space API
- **Payments**: Dodo Payments
- **Email**: SendGrid
- **Vector DB**: Pinecone

## Architecture

### Artifacts
- `artifacts/contract-ai` — React+Vite frontend (serves at `/`)
- `artifacts/api-server` — Express backend (serves at `/api`)

### Database Schema (lib/db/src/schema/)
- `users` — Supabase user IDs, plan (free/pro/premium), contractsUsed
- `contracts` — uploaded PDFs, status tracking
- `analyses` — AI analysis results (summary, risks[], keyClauses[], riskLevel)
- `chat_messages` — Premium AI chat history

### API Routes (artifacts/api-server/src/routes/)
- `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`
- `/api/contracts` — CRUD for contracts
- `/api/contracts/:id/analyze` — GROQ AI analysis
- `/api/chat/:contractId` — Premium AI chat
- `/api/payments/checkout` — Dodo Payments checkout
- `/api/payments/webhook` — Dodo webhook handler
- `/api/dashboard/stats`, `/api/dashboard/recent`

### Frontend Pages (artifacts/contract-ai/src/pages/)
- `/` — Landing page
- `/auth` — Login/signup
- `/dashboard` — Stats and recent activity
- `/contracts` — Contract list
- `/contracts/upload` — PDF upload + instant analysis
- `/contracts/:id` — Contract detail + analysis results + AI chat
- `/pricing` — Plan comparison + upgrade
- `/settings` — Account info + logout

## Plans
- Free: 3 contracts
- Pro: 50 contracts ($19/mo via Dodo)
- Premium: Unlimited + AI chat ($49/mo via Dodo)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Environment Variables Required
- `SESSION_SECRET` — Express session signing
- `GROQ_API_KEY` — AI analysis
- `OCR_API_KEY` — PDF text extraction (ocr.space)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Auth
- `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_PRO_PLAN_ID`, `DODO_PREMIUM_PLAN_ID` — Payments
- `SENDGRID_API_KEY` — Email (optional)
- `PINECONE_API_KEY` — Vector search (optional)
- `SUPPORT_EMAIL` — Support contact
