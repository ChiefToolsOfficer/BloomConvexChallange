# Product Requirements Document (PRD)
## User Lifecycle Email Automation System

**Version**: 1.0  
**Author**: [Your Name]  
**Date**: December 2024  
**Status**: Ready for Development

---

## 1. Executive Summary

### 1.1 Problem Statement
Our SaaS application lacks automated user lifecycle email communication. Users sign up but don't receive welcome emails, become inactive without re-engagement attempts, and churn without intervention. We need visibility into email performance and user lifecycle stages.

### 1.2 Solution
Build a lightweight, serverless email automation system that:
- Automatically triggers emails based on user actions and time-based conditions
- Logs all email activity with delivery tracking
- Provides a real-time dashboard for monitoring performance

### 1.3 Success Metrics
- 100% of signups receive welcome email within 5 seconds
- Inactive user email sent within 24 hours of 7-day inactivity threshold
- Dashboard loads in < 2 seconds with real-time updates
- Email delivery rate > 95%

---

## 2. Technical Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CONVEX CLOUD                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Users     │  │  Email Logs │  │ Email Stats │  │   Crons    │ │
│  │   Table     │  │   Table     │  │   Table     │  │            │ │
│  └──────┬──────┘  └─────────────┘  └─────────────┘  └─────┬──────┘ │
│         │                                                   │       │
│         ▼                                                   ▼       │
│  ┌─────────────┐                                    ┌─────────────┐ │
│  │  Triggers   │──────────────────────────────────▶│  Lifecycle  │ │
│  │ (on write)  │                                    │   Checks    │ │
│  └──────┬──────┘                                    └──────┬──────┘ │
│         │                                                   │       │
│         ▼                                                   ▼       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Email Actions                             │   │
│  │              (Call Loops.so API + Log)                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                    │                                │
│                                    ▼                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  HTTP Actions (Webhooks)                     │   │
│  │                /loops-webhook (POST)                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         LOOPS.SO                                     │
│  • Send transactional emails                                        │
│  • Send event-triggered sequences                                   │
│  • Webhook delivery notifications                                   │
└─────────────────────────────────────────────────────────────────────┘
                                    
┌─────────────────────────────────────────────────────────────────────┐
│                      VERCEL (Next.js)                               │
│  • Dashboard UI                                                     │
│  • Real-time queries via Convex React client                       │
│  • Charts and analytics visualization                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Component | Technology | Justification |
|-----------|------------|---------------|
| Database | Convex | Existing infrastructure, real-time queries, serverless |
| Email API | Loops.so | Modern API, good deliverability, event-based triggers |
| Frontend | Next.js 14 | App Router, server components, Vercel integration |
| Hosting | Vercel + Convex Cloud | Zero-config deployment, generous free tiers |
| Styling | Tailwind CSS | Rapid development, consistent design |
| Charts | Recharts | React-native, good documentation |

### 2.3 Data Flow

**Trigger-based Flow (Signup Example):**
1. Frontend calls `createUser` mutation
2. Convex mutation inserts user document
3. Database trigger detects insert
4. Trigger schedules `sendEvent` action
5. Action calls Loops.so API
6. Action logs email to `emailLogs` table
7. Action updates `emailStats` aggregates

**Cron-based Flow (Inactive Reminder):**
1. Cron job fires at 9 AM UTC daily
2. Query finds users with `lastActiveAt` > 7 days
3. For each user, schedule `sendEvent` action
4. Mark user with `lastInactiveReminderAt` timestamp

**Webhook Flow (Delivery Tracking):**
1. Loops.so sends POST to `/loops-webhook`
2. HTTP action parses event type and message ID
3. Update `emailLogs` document with new status
4. Update `emailStats` daily aggregates

---

## 3. Functional Requirements

### 3.1 Email Events

| Event Name | Trigger Type | Trigger Condition | Email Content |
|------------|--------------|-------------------|---------------|
| `signup` | Database trigger | User document created | Welcome, getting started guide |
| `subscription_cancelled` | Database trigger | `subscriptionStatus` → "cancelled" | Feedback request, win-back offer |
| `plan_upgraded` | Database trigger | `plan` changed to higher tier | Thank you, new features overview |
| `inactive_reminder` | Cron (daily) | `lastActiveAt` > 7 days ago | Re-engagement, feature highlights |
| `trial_ending` | Cron (daily) | `trialEndDate` within 3 days | Upgrade prompt, value summary |
| `onboarding_incomplete` | Cron (weekly) | `onboardingCompleted: false` after 3 days | Setup help, quick start guide |

### 3.2 Database Schema

#### 3.2.1 Users Table (Extended)

```typescript
users: defineTable({
  // Identity
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  clerkId: v.optional(v.string()),
  
  // Subscription
  plan: v.optional(v.string()),              // "free" | "trial" | "pro" | "enterprise"
  subscriptionStatus: v.optional(v.string()), // "active" | "cancelled" | "past_due"
  trialEndDate: v.optional(v.number()),
  
  // Activity
  lastActiveAt: v.optional(v.number()),
  onboardingCompleted: v.optional(v.boolean()),
  lifecycleStage: v.optional(v.string()),    // Computed: "new" | "onboarding" | "active" | "at_risk" | "churned"
  
  // Email tracking (spam prevention)
  lastInactiveReminderAt: v.optional(v.number()),
  trialEndingReminderSent: v.optional(v.number()),
  onboardingReminderSent: v.optional(v.number()),
})
```

#### 3.2.2 Email Logs Table

```typescript
emailLogs: defineTable({
  eventName: v.string(),
  email: v.string(),
  userId: v.optional(v.id("users")),
  loopsMessageId: v.optional(v.string()),
  transactionalId: v.optional(v.string()),
  status: v.string(),                        // "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed"
  sentAt: v.number(),
  deliveredAt: v.optional(v.number()),
  openedAt: v.optional(v.number()),
  clickedAt: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  metadata: v.optional(v.any()),
})
```

#### 3.2.3 Email Stats Table

```typescript
emailStats: defineTable({
  date: v.string(),                          // "2024-01-15"
  eventName: v.string(),
  sent: v.number(),
  delivered: v.number(),
  opened: v.number(),
  clicked: v.number(),
  bounced: v.number(),
  failed: v.number(),
})
```

### 3.3 API Endpoints

#### 3.3.1 Convex Functions

| Function | Type | Purpose |
|----------|------|---------|
| `emails.sendEvent` | Internal Action | Call Loops.so events API, log result |
| `emails.sendTransactionalEmail` | Internal Action | Call Loops.so transactional API, log result |
| `emails.updateEmailStatus` | Internal Mutation | Update log from webhook |
| `userLifecycle.checkInactiveUsers` | Internal Action | Cron handler for inactive check |
| `userLifecycle.checkExpiringTrials` | Internal Action | Cron handler for trial check |
| `dashboard.getDashboardSummary` | Query | Aggregate stats for dashboard |
| `dashboard.getDailyChartData` | Query | Time series data for charts |
| `dashboard.getRecentEmailLogs` | Query | Paginated, filterable logs |

#### 3.3.2 HTTP Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `/loops-webhook` | POST | Receive Loops.so delivery events |
| `/health` | GET | Health check endpoint |

### 3.4 Dashboard Features

#### 3.4.1 Dashboard Home Page

**Summary Cards:**
- Emails Sent (30 days) with today's count
- Delivery Rate (%) with trend indicator
- Open Rate (%) with trend indicator  
- Active Users count with at-risk count

**Charts:**
- Line chart: Daily email volume (sent, delivered, opened) - 30 days
- Bar chart: Emails by event type - horizontal bars

**User Lifecycle Funnel:**
- Visual funnel showing: Total → New → Onboarding → Active → At Risk → Churned
- Percentage and absolute counts

**Performance Table:**
- Columns: Event Name, Sent, Delivered, Opened, Open Rate, Click Rate
- Color-coded rates (green > 25%, yellow > 15%, red < 15%)

#### 3.4.2 Email Logs Page

**Filters:**
- Event type dropdown (all events)
- Status dropdown (all statuses)

**Table:**
- Columns: Time (relative), Event, Email, Status (badge), Error
- Real-time updates
- Most recent first

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Requirement |
|--------|-------------|
| Email trigger latency | < 5 seconds from user action to email queued |
| Dashboard initial load | < 2 seconds |
| Dashboard update latency | < 500ms (real-time) |
| Webhook processing | < 1 second |

### 4.2 Reliability

| Metric | Requirement |
|--------|-------------|
| Email delivery (Loops.so) | > 95% delivery rate |
| Cron job execution | 100% execution rate (Convex guarantee) |
| Data consistency | Triggers run in same transaction as data change |

### 4.3 Scalability

| Metric | Limit |
|--------|-------|
| Users | 10,000+ (Convex scales automatically) |
| Emails per day | 10,000+ (Loops.so rate limits apply) |
| Concurrent dashboard users | 100+ (Convex handles subscriptions) |

### 4.4 Security

- Loops.so API key stored in Convex environment variables (not in code)
- Webhook signature verification (if Loops.so provides)
- No PII exposed in client-side code
- HTTPS for all communications

---

## 5. User Interface Specifications

### 5.1 Dashboard Home Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  📧 Email Lifecycle                    Dashboard | Logs | Users     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │  1,234   │ │  98.5%   │ │  24.3%   │ │   892    │               │
│  │ Sent 30d │ │ Delivery │ │ Open Rate│ │  Active  │               │
│  │ 45 today │ │    ↑     │ │    →     │ │ 23 risk  │               │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
│                                                                     │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐   │
│  │     Email Volume (30d)      │ │    Emails by Event Type     │   │
│  │  ╭─────────────────────╮    │ │                             │   │
│  │  │    ~~~~/\~~~~       │    │ │  signup        ████████     │   │
│  │  │   /        \  /\    │    │ │  inactive      ████         │   │
│  │  │  /          \/  \   │    │ │  trial_ending  ██           │   │
│  │  ╰─────────────────────╯    │ │  cancelled     █            │   │
│  └─────────────────────────────┘ └─────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  User Lifecycle Funnel                                       │   │
│  │  Total      ████████████████████████████████████████  1000   │   │
│  │  New        ████████████                              120    │   │
│  │  Onboarding ████████                                   80    │   │
│  │  Active     ████████████████████████████              600    │   │
│  │  At Risk    ████████                                  150    │   │
│  │  Churned    ██████                                     50    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Event Performance (30 Days)                                 │   │
│  │  ─────────────────────────────────────────────────────────── │   │
│  │  Event          Sent    Delivered  Opened   Open%   Click%   │   │
│  │  signup         450     448        156      34.8%   12.3%    │   │
│  │  inactive       234     230        45       19.5%   8.2%     │   │
│  │  trial_ending   89      88         34       38.6%   22.1%    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Email Logs Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  📧 Email Lifecycle                    Dashboard | Logs | Users     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Email Logs                                                         │
│  View all sent emails and their status                              │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐                                   │
│  │ All Events ▼│ │ All Status ▼│                                   │
│  └─────────────┘ └─────────────┘                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Time          Event           Email              Status      │   │
│  │ ───────────────────────────────────────────────────────────  │   │
│  │ 2 min ago    [signup]        alex@example.com   [delivered]  │   │
│  │ 5 min ago    [inactive]      jane@test.com      [opened]     │   │
│  │ 1 hour ago   [signup]        bob@company.co     [sent]       │   │
│  │ 2 hours ago  [cancelled]     old@user.com       [delivered]  │   │
│  │ 3 hours ago  [trial_ending]  trial@test.com     [clicked]    │   │
│  │ ...                                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Primary | Indigo | #6366f1 |
| Success | Green | #22c55e |
| Warning | Amber | #f59e0b |
| Error | Red | #ef4444 |
| Background | Gray 50 | #f9fafb |
| Card | White | #ffffff |
| Text Primary | Gray 900 | #111827 |
| Text Secondary | Gray 500 | #6b7280 |

### 5.4 Status Badge Colors

| Status | Background | Text |
|--------|------------|------|
| sent | blue-100 | blue-800 |
| delivered | green-100 | green-800 |
| opened | purple-100 | purple-800 |
| clicked | indigo-100 | indigo-800 |
| bounced | red-100 | red-800 |
| failed | red-100 | red-800 |

---

## 6. Implementation Plan

### Phase 1: Backend Foundation (Day 1-2)
- [ ] Set up Convex schema with all tables
- [ ] Implement Loops.so email service (sendEvent, sendTransactional)
- [ ] Create email logging functions
- [ ] Set up database triggers

### Phase 2: Automation Logic (Day 2-3)
- [ ] Implement cron job handlers
- [ ] Configure cron schedules
- [ ] Add webhook HTTP handler
- [ ] Test end-to-end email flow

### Phase 3: Dashboard Queries (Day 3-4)
- [ ] Implement dashboard summary query
- [ ] Implement daily chart data query
- [ ] Implement event stats query
- [ ] Implement logs query with filters

### Phase 4: Frontend Dashboard (Day 4-5)
- [ ] Set up Next.js with Convex provider
- [ ] Build dashboard home page
- [ ] Build email logs page
- [ ] Add real-time updates

### Phase 5: Testing & Deployment (Day 5-6)
- [ ] Test all trigger scenarios
- [ ] Test cron job execution
- [ ] Test webhook processing
- [ ] Deploy to Vercel
- [ ] Configure Loops.so webhooks

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Loops.so rate limits | Emails delayed | Implement retry logic, batch operations |
| Trigger not firing | Missed emails | Ensure all mutations use wrapped functions |
| Webhook failures | Missing status updates | Log raw webhooks, implement retry |
| Dashboard slow | Poor UX | Use aggregated stats table, pagination |

---

## 8. Future Enhancements

- A/B testing for email content
- Custom email scheduling (user timezone)
- Email template preview in dashboard
- Export logs to CSV
- Slack notifications for bounces
- User segmentation for campaigns

---

## 9. Glossary

| Term | Definition |
|------|------------|
| Lifecycle Stage | User's current engagement phase (new, active, churned, etc.) |
| Transactional Email | One-off email triggered by specific action (password reset, receipt) |
| Event | Named trigger sent to Loops.so to start an automated sequence |
| Cron Job | Scheduled function that runs at specified intervals |
| Trigger | Code that runs automatically when database changes |
| Webhook | HTTP callback from external service (Loops.so delivery events) |

---

## 10. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| Engineering | | | |
