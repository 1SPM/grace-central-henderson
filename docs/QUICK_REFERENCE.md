# Grace CRM - Quick Reference Card

## Shortcuts
| Key | Action |
|-----|--------|
| `N` | New person |
| `T` | New task |
| `P` | New prayer |
| `D` | New donation |
| `/` | Search |

## Member Statuses
| Status | Color | Meaning |
|--------|-------|---------|
| Visitor | Blue | First-time guest |
| Regular | Green | Attending regularly |
| Member | Purple | Official member |
| Leader | Gold | Leadership role |
| Inactive | Gray | Not attending |

## Task Priorities
- **High** (Red) - Urgent, do today
- **Medium** (Yellow) - This week
- **Low** (Green) - When possible

## Task Categories
- **Follow-up** - Visitor/member contact
- **Care** - Pastoral care needs
- **Admin** - Administrative tasks
- **Outreach** - Community outreach

## API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/health` | Server status |
| `/api/ai/health` | AI status |
| `/api/agents/health` | Agents status |

## Environment Variables
```
VITE_SUPABASE_URL=         # Database
VITE_SUPABASE_ANON_KEY=    # Database key
VITE_CLERK_PUBLISHABLE_KEY= # Auth
GEMINI_API_KEY=            # AI features
STRIPE_SECRET_KEY=         # Payments
```

## Commands
```bash
npm run dev      # Start development
npm run build    # Production build
npm test         # Run tests
```
