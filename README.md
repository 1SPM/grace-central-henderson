# GRACE CRM

<div align="center">
  <img src="https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-3.3-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Vite-5.0-646CFF?style=flat-square&logo=vite" alt="Vite" />
</div>

<br />

<div align="center">
  <h3>🙏 Never lose a visitor again.</h3>
  <p>A modern, simple CRM designed specifically for small-to-midsize churches.</p>
</div>

---

## What is GRACE?

**GRACE** stands for:

| Letter | Meaning | Feature |
|--------|---------|---------|
| **G** | Growth | Track congregation growth and visitor conversion |
| **R** | Relationships | Manage member profiles, families, and interactions |
| **A** | Attendance | Monitor service and event attendance patterns |
| **C** | Community | Small groups, prayer requests, and fellowship |
| **E** | Engagement | Follow-ups, tasks, and care management |

---

## Why GRACE?

**The Problem:** 82% of first-time church visitors never come back. Most churches have no systematic follow-up process—they rely on memory, sticky notes, or spreadsheets that get forgotten by Tuesday.

**The Solution:** GRACE is a simple, affordable CRM that automates visitor follow-up and helps small-to-midsize churches (50-500 members) build lasting relationships with their community.

### What Makes GRACE Different

| Feature | GRACE | Legacy Church Software |
|---------|-------|------------------------|
| **Setup Time** | 5 minutes | Hours/Days |
| **Learning Curve** | Intuitive | Training required |
| **Price** | $29-149/mo | $75-400+/mo |
| **Focus** | Visitor follow-up | Everything (overwhelming) |
| **Mobile-First** | Yes | Often an afterthought |

---

## Features

### 📊 Dashboard
- At-a-glance view of visitors, tasks, and members needing attention
- Priority follow-ups with overdue detection
- Inactive member alerts
- **Analytics charts** with member distribution and conversion metrics
- **Upcoming birthdays** widget (next 30 days)

### ➕ Quick Actions
- Floating action button for fast data entry
- Quickly add people, tasks, or prayer requests from anywhere
- Streamlined forms for on-the-go updates

### 📈 Visitor Pipeline
- **Kanban-style board** showing member journey
- Visual stages: Visitor → Regular → Member → Leader
- Track conversion progress at a glance
- Click-through to individual profiles

### 👥 People Management
- Complete member profiles with contact info and notes
- Status tracking: Visitor → Regular → Member → Leader
- Tag system for organization
- Interaction logging (calls, emails, visits, prayers)
- Birthday tracking with automatic reminders

### ✅ Follow-Up Tasks
- Priority-based task management
- Category filters: Follow-up, Care, Admin, Outreach
- Overdue task alerts
- Person-linked tasks

### 📅 Calendar
- Service schedules
- Small group meetings
- Church events

### 🤝 Small Groups
- Group management with leaders and members
- Meeting schedules and locations
- Member directory per group

### 🙏 Prayer Requests
- Public and private prayer tracking
- Mark prayers as answered
- Testimony recording

### 💝 Giving Dashboard
- Giving overview by fund
- Recurring gift tracking
- Transaction history

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/grace-crm.git
cd grace-crm

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

---

## Tech Stack

- **Frontend:** React 18 + TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Build:** Vite
- **Dates:** date-fns

---

## Project Structure

```
grace-crm/
├── src/
│   ├── components/
│   │   ├── Layout.tsx         # Sidebar navigation
│   │   ├── Dashboard.tsx      # Main dashboard
│   │   ├── DashboardCharts.tsx # Analytics charts
│   │   ├── BirthdayWidget.tsx # Upcoming birthdays
│   │   ├── VisitorPipeline.tsx # Kanban pipeline view
│   │   ├── QuickActions.tsx   # Floating action button
│   │   ├── QuickTaskForm.tsx  # Quick task modal
│   │   ├── QuickPrayerForm.tsx # Quick prayer modal
│   │   ├── PeopleList.tsx     # Congregation list
│   │   ├── PersonProfile.tsx  # Individual profile
│   │   ├── Tasks.tsx          # Follow-up management
│   │   ├── Calendar.tsx       # Events calendar
│   │   ├── Groups.tsx         # Small groups
│   │   ├── Prayer.tsx         # Prayer requests
│   │   ├── Giving.tsx         # Giving dashboard
│   │   └── Settings.tsx       # Configuration
│   ├── types.ts               # TypeScript interfaces
│   ├── constants.ts           # Sample data
│   ├── App.tsx                # Main application
│   ├── main.tsx               # Entry point
│   └── index.css              # Tailwind imports
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Roadmap

### Phase 1: Core CRM ✅
- [x] People management
- [x] Task/follow-up system
- [x] Prayer requests
- [x] Small groups
- [x] Giving overview
- [x] Dark mode support

### Phase 2: Enhanced UI ✅
- [x] Quick Actions floating button
- [x] Visitor Pipeline (kanban view)
- [x] Dashboard analytics charts
- [x] Birthday/anniversary widget
- [x] Global search

### Phase 3: Backend Integration (Current)
- [x] Supabase database connection
- [ ] User authentication (Clerk)
- [ ] Multi-church support
- [ ] Stripe payments

### Phase 4: Automation
- [ ] Automated visitor follow-up emails
- [ ] Attendance tracking integration
- [ ] Task reminder notifications
- [ ] SMS messaging
- [ ] Birthday auto-reminders

### Phase 5: Community Layer
- [ ] Member-facing app / portal
- [ ] Prayer wall (public sharing)
- [ ] Event RSVPs
- [ ] Small group communication
- [ ] Volunteer scheduling

### Phase 6: Advanced Features
- [ ] Reporting & export (CSV/PDF)
- [ ] Attendance check-in system
- [ ] Giving trends & charts
- [ ] Mobile PWA support
- [ ] Offline mode

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## License

MIT License - feel free to use this for your church!

---

<div align="center">
  <p><strong>GRACE</strong> - Growth · Relationships · Attendance · Community · Engagement</p>
  <p>Built with ❤️ for churches everywhere</p>
</div>
