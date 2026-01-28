# Grace CRM - Client Setup & Usage Guide

## Quick Start (5 Minutes)

### 1. Environment Setup

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

### 2. Required Services

| Service | Purpose | Get Key From | Required? |
|---------|---------|--------------|-----------|
| **Supabase** | Database | [supabase.com](https://supabase.com) | Yes |
| **Clerk** | User Auth | [clerk.com](https://clerk.com) | Yes (prod) |
| **Stripe** | Payments | [stripe.com](https://stripe.com) | For donations |
| **Gemini** | AI Features | [ai.google.dev](https://ai.google.dev) | For AI messages |
| **Resend** | Email | [resend.com](https://resend.com) | For email |
| **Twilio** | SMS | [twilio.com](https://twilio.com) | For SMS |

### 3. Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## Features Overview

### Dashboard
- **Overview stats**: Total people, new visitors, tasks due
- **Priority follow-ups**: Overdue tasks needing attention
- **Recent visitors**: Last 30 days with quick access
- **Community snapshot**: Member/visitor breakdown

### People Management
- Add/edit member profiles
- Track status: Visitor → Regular → Member → Leader
- Tag system for organization
- **Pagination**: 25 per page (configurable: 10/25/50/100)
- Bulk actions: Change status, add tags, export
- CSV import/export

### Visitor Pipeline
- Kanban-style board
- Drag members through stages
- Visual conversion tracking

### Tasks
- Priority levels: High, Medium, Low
- Categories: Follow-up, Care, Admin, Outreach
- Due date tracking with overdue alerts
- Link tasks to people

### Prayer Requests
- Public/private prayers
- Mark as answered
- Record testimonies

### Small Groups
- Group management
- Leader assignment
- Meeting schedules

### Giving
- Track donations by fund
- Recurring gift management
- Giving statements

### AI Agents
- **Life Event Agent**: Birthday/anniversary automation
- **Donation Agent**: Thank-you messages
- **New Member Agent**: Welcome sequences

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | Add new person |
| `T` | Quick task |
| `P` | Quick prayer |
| `M` | Quick note |
| `D` | Quick donation |
| `/` | Global search |
| `Esc` | Close modals |

---

## Database Setup (Supabase)

### 1. Create Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy URL and anon key to `.env`

### 2. Run Migrations
In Supabase SQL Editor, run these files in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_collection_donation_system.sql`
3. `supabase/migrations/003_ai_messaging_system.sql`
4. `supabase/migrations/004_agent_logging_system.sql`

### 3. Add Seed Data (Optional)
Run `supabase/seed.sql` for sample data.

---

## Authentication (Clerk)

### 1. Create Application
1. Go to [clerk.com](https://clerk.com)
2. Create new application
3. Copy publishable key to `.env`

### 2. Configure
- Enable email/password sign-in
- Customize branding to match your church

### 3. Backend Auth
Add `CLERK_SECRET_KEY` to `.env` for API protection.

---

## AI Features (Gemini)

### Setup
1. Go to [ai.google.dev](https://ai.google.dev)
2. Create API key (free tier: 60 requests/minute)
3. Add to `.env` as `GEMINI_API_KEY`

### Features
- **Welcome messages**: Personalized new member greetings
- **Donation thank-yous**: Heartfelt acknowledgments
- **Birthday greetings**: Automated birthday messages
- **Follow-up talking points**: Visitor call prep
- **Prayer summaries**: Weekly digest generation

---

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

Add environment variables in Vercel dashboard.

### Netlify
```bash
npm run build
# Deploy dist/ folder
```

### Backend API
The backend runs on port 3001. For production:
- Use Vercel serverless functions (already configured in `/api`)
- Or deploy Express server separately

---

## Security Checklist

- [ ] Disable demo mode in production (`VITE_ENABLE_DEMO_MODE=false`)
- [ ] Configure Clerk authentication
- [ ] Use HTTPS
- [ ] Enable Supabase Row Level Security (RLS)
- [ ] Keep API keys secret (never commit `.env`)
- [ ] Rotate keys periodically

---

## Troubleshooting

### "Demo Mode" showing
- Set `VITE_ENABLE_DEMO_MODE=false` in `.env`
- Configure Supabase credentials

### AI not working
- Check `GEMINI_API_KEY` is set
- Verify at `/api/ai/health` endpoint

### Database not connecting
- Verify Supabase URL and key
- Check network connectivity
- Run migrations if tables missing

### Build errors
```bash
npm run build
```
Check TypeScript errors in output.

---

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: This guide + README.md
- API Health: `http://localhost:3001/health`

---

## Version

**Grace CRM v1.0 Beta**
- Build: Production Ready
- Tests: 79 passing
- Last updated: January 2026
