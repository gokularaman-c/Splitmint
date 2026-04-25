# SplitMint

SplitMint is a modern group expense-splitting web application that helps users create groups, add shared expenses, track balances, and view simplified settlement suggestions.

The app also includes **MintSense**, an AI-assisted feature that can parse natural-language expense entries and convert them into structured expenses.

## Live Demo

**Deployed App:** https://splitmint-steel.vercel.app

---

## Features

- Email/password authentication
- Google OAuth login
- Create and manage expense groups
- Add participants to a group
- Add expenses manually
- Select payer and split participants
- Equal split calculation
- Balance calculation for each participant
- Settlement suggestions to minimize repayments
- MintSense AI for natural-language expense entry
- INR currency display with `₹`
- Responsive mint-themed UI
- Supabase database integration
- Supabase Edge Function for AI parsing
- Vercel deployment

---

## Example Flow

1. User signs in using email/password or Google.
2. User creates a group, for example `Coorg`.
3. User adds participants like `A`, `B`, and `C`.
4. User adds an expense manually, for example:
   - Description: `Dinner`
   - Amount: `₹1000`
   - Paid by: `You`
   - Split between: `You, A, B, C`
5. SplitMint calculates:
   - Total spent
   - Individual balances
   - Who owes whom
6. User can also use MintSense:
   - Input: `I paid 800 for lunch today split with A, B and C`
   - Output: A structured expense is automatically added.

---

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- TanStack Router / TanStack Start
- Tailwind CSS
- Radix UI
- Lucide React
- Sonner

### Backend / Database

- Supabase
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security
- Supabase Edge Functions

### AI

- MintSense AI via Supabase Edge Function
- OpenAI-compatible chat completions endpoint
- Gemini API-compatible configuration

### Deployment

- Vercel
- Supabase Cloud

---

## Project Structure

```text
SplitMint
├── src
│   ├── components
│   │   ├── AppShell.tsx
│   │   └── ui
│   ├── hooks
│   │   └── useAuth.tsx
│   ├── integrations
│   │   └── supabase
│   ├── lib
│   │   ├── balance.ts
│   │   └── utils.ts
│   ├── routes
│   │   ├── __root.tsx
│   │   ├── auth.tsx
│   │   ├── dashboard.tsx
│   │   ├── groups.$groupId.tsx
│   │   └── index.tsx
│   ├── router.tsx
│   ├── routeTree.gen.ts
│   └── styles.css
├── supabase
│   ├── functions
│   │   └── mintsense
│   │       └── index.ts
│   └── migrations
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## Core Logic

The main balance and settlement calculations are handled in:

```text
src/lib/balance.ts
```

The app calculates:

* Total group spending
* Net balance for each participant
* Who should pay whom
* Simplified settlement suggestions

Example:

If one person pays `₹1000` for 4 people:

```text
₹1000 / 4 = ₹250 per person
Payer's own share = ₹250
Other 3 participants owe ₹250 each
Payer's net balance = +₹750
```

---

## MintSense AI

MintSense allows users to enter expenses using natural language.

Example input:

```text
I paid 800 for lunch today split with A, B and C
```

Expected result:

```text
Description: lunch
Amount: ₹800
Paid by: current user
Split between: current user, A, B, C
Split mode: equal
```

MintSense is implemented as a Supabase Edge Function:

```text
supabase/functions/mintsense/index.ts
```

---

## Environment Variables

Create a `.env` file using `.env.example` as reference.

```env
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_PROJECT_ID=your_supabase_project_id_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
VITE_SUPABASE_URL=your_supabase_url_here
```

For Supabase Edge Function AI support, set these secrets in Supabase:

```env
AI_API_KEY=your_ai_api_key_here
AI_API_URL=your_openai_compatible_chat_completions_url_here
AI_MODEL=your_ai_model_here
```

Example:

```env
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
AI_MODEL=gemini-3-flash-preview
```

Do not commit real API keys or secrets to GitHub.

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/gokularaman-c/Splitmint.git
cd Splitmint
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env`

Create a `.env` file in the root directory and add your Supabase values:

```env
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_PROJECT_ID=your_supabase_project_id_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
VITE_SUPABASE_URL=your_supabase_url_here
```

### 4. Run the development server

```bash
npm run dev
```

The app will usually run at:

```text
http://localhost:3000
```

or:

```text
http://localhost:5173
```

depending on the available port.

### 5. Build the project

```bash
npm run build
```

---

## Supabase Setup

### 1. Create a Supabase project

Create a new project in Supabase and copy:

* Project URL
* Publishable key
* Project reference ID

### 2. Apply database migration

Run the SQL migration from:

```text
supabase/migrations
```

You can apply it through:

```text
Supabase Dashboard → SQL Editor → New Query → Paste SQL → Run
```

### 3. Configure authentication

Enable:

* Email/password authentication
* Google OAuth provider

For Google OAuth, configure:

```text
Supabase → Authentication → Sign In / Providers → Google
```

Add:

* Google Client ID
* Google Client Secret

### 4. Configure redirect URLs

In Supabase:

```text
Authentication → URL Configuration
```

Set Site URL:

```text
https://splitmint-steel.vercel.app
```

Add redirect URLs:

```text
https://splitmint-steel.vercel.app/**
https://splitmint-steel.vercel.app/dashboard
https://splitmint-steel.vercel.app/auth
http://localhost:3000/**
http://localhost:3000/dashboard
```

---

## Supabase Edge Function Setup

### 1. Install Supabase CLI

```bash
brew install supabase/tap/supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link the project

```bash
supabase link --project-ref your_project_ref
```

### 4. Deploy MintSense function

```bash
supabase functions deploy mintsense
```

### 5. Set AI secrets

```bash
supabase secrets set \
  AI_API_KEY="your_ai_api_key_here" \
  AI_API_URL="your_openai_compatible_chat_completions_url_here" \
  AI_MODEL="your_ai_model_here"
```

---

## Vercel Deployment

The app is deployed using Vercel.

### Build command

```bash
npm run build
```

### Install command

```bash
npm install
```

### Output

The project uses TanStack Start with Nitro. The Vercel deployment should use the Nitro-compatible output generated during build.

The Vite config includes Nitro support:

```ts
import { nitro } from "nitro/vite";
```

---

## Current Status

The current version supports:

* Working production deployment
* Google login
* Email/password login
* Group creation
* Manual expense creation
* AI-based expense creation through MintSense
* Balance calculation
* Settlement suggestions
* INR currency display

---

## Future Improvements

* Add multiple split modes with richer validation
* Add expense editing history
* Add group invite links
* Add recurring expenses
* Add export to CSV/PDF
* Add dashboard analytics
* Add multi-currency support
* Improve MintSense summaries
* Add mobile-first PWA support

---

## Author

**Gokularaman C**
