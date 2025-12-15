# User Lifecycle Email Automation System
## Complete Implementation Guide

**Last Updated:** December 2024
**Tech Stack:** Convex + Loops.so + Next.js 14 + Recharts + Tailwind CSS

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Phase 1: Project Setup](#3-phase-1-project-setup)
4. [Phase 2: Database Schema](#4-phase-2-database-schema)
5. [Phase 3: Email Service (Loops.so)](#5-phase-3-email-service-loopsso)
6. [Phase 4: Database Triggers](#6-phase-4-database-triggers)
7. [Phase 5: Cron Jobs](#7-phase-5-cron-jobs)
8. [Phase 6: Webhook Handler](#8-phase-6-webhook-handler)
9. [Phase 7: Dashboard Queries](#9-phase-7-dashboard-queries)
10. [Phase 8: Next.js Frontend](#10-phase-8-nextjs-frontend)
11. [Phase 9: Environment & Deployment](#11-phase-9-environment--deployment)
12. [Testing Checklist](#12-testing-checklist)

---

## 1. Project Overview

### 1.1 What We're Building
A serverless email automation system that:
- **Automatically triggers emails** when users sign up, cancel subscriptions, upgrade plans
- **Runs scheduled checks** for inactive users, expiring trials, incomplete onboarding
- **Tracks all email activity** with delivery/open/click status via webhooks
- **Provides a real-time dashboard** for monitoring email performance and user lifecycle

### 1.2 Key Constraint
All automation logic runs inside Convex using:
- Database triggers (via convex-helpers)
- Scheduled functions (cron jobs)
- HTTP actions (webhooks)

No external automation services or hosting required.

### 1.3 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database & Backend | Convex | Real-time reactive database + serverless functions |
| Email Provider | Loops.so | Transactional + event-based emails with webhooks |
| Triggers Library | convex-helpers | Database change detection |
| Frontend | Next.js 14 | App Router with Server/Client Components |
| Charts | Recharts | LineChart, BarChart visualizations |
| Styling | Tailwind CSS | Utility-first CSS |
| Icons | Lucide React | Icon library |
| Date Utils | date-fns | Date formatting |

---

## 2. Architecture

### 2.1 System Diagram
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONVEX CLOUD                                   │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │    users     │  │  emailLogs   │  │  emailStats  │  │   crons.ts  │ │
│  │    table     │  │    table     │  │    table     │  │  (schedules)│ │
│  └──────┬───────┘  └──────────────┘  └──────────────┘  └──────┬──────┘ │
│         │                                                       │        │
│         ▼                                                       ▼        │
│  ┌──────────────┐                                      ┌──────────────┐ │
│  │   Triggers   │                                      │  Lifecycle   │ │
│  │ (on insert/  │                                      │   Checks     │ │
│  │   update)    │                                      │  (daily/     │ │
│  └──────┬───────┘                                      │   weekly)    │ │
│         │                                              └──────┬───────┘ │
│         │                                                     │         │
│         ▼                                                     ▼         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      emails.ts                                   │   │
│  │   sendEvent() ─────► Loops.so Events API                        │   │
│  │   sendTransactional() ─────► Loops.so Transactional API         │   │
│  │   logEmailEvent() ─────► emailLogs table                        │   │
│  │   updateDailyStats() ─────► emailStats table                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      http.ts (Webhooks)                          │   │
│  │              POST /loops-webhook                                 │   │
│  │   Receives: delivered, opened, clicked, bounced events          │   │
│  │   Updates: emailLogs status + emailStats counters               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           LOOPS.SO                                       │
│  • Receives events (signup, subscription_cancelled, etc.)               │
│  • Sends transactional emails                                           │
│  • Sends webhook notifications (delivered, opened, clicked, bounced)    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      VERCEL (Next.js 14)                                │
│  • Dashboard UI with real-time updates                                  │
│  • useQuery hooks for reactive data                                     │
│  • Recharts for visualizations                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Patterns

**Pattern A: Trigger-Based Email (e.g., Signup)**
```
1. Frontend calls createUser mutation
2. Mutation inserts user document
3. Trigger detects insert operation
4. Trigger schedules sendEvent action (delay: 0ms)
5. Action calls Loops.so Events API
6. Action logs email to emailLogs
7. Action updates emailStats
```

**Pattern B: Cron-Based Email (e.g., Inactive Reminder)**
```
1. Cron job fires at 9 AM UTC
2. Handler queries users with lastActiveAt > 7 days
3. For each user (with spam prevention check):
   - Schedule sendEvent action
   - Update lastInactiveReminderAt timestamp
4. Action calls Loops.so + logs result
```

**Pattern C: Webhook Status Update**
```
1. Loops.so sends POST to /loops-webhook
2. HTTP action parses event (delivered/opened/clicked/bounced)
3. Mutation updates emailLogs with new status + timestamp
4. Mutation increments emailStats counters
```

---

## 3. Phase 1: Project Setup

### 3.1 Create Project Directory
```bash
mkdir email-automation-system
cd email-automation-system
```

### 3.2 Initialize npm and Install Dependencies
```bash
# Initialize package.json
npm init -y

# Install production dependencies
npm install convex convex-helpers next@14 react react-dom recharts lucide-react date-fns

# Install dev dependencies
npm install -D typescript @types/react @types/react-dom @types/node tailwindcss postcss autoprefixer
```

### 3.3 Initialize Tailwind CSS
```bash
npx tailwindcss init -p
```

### 3.4 Initialize Convex
```bash
# Login to Convex (opens browser)
npx convex login

# Initialize Convex in this project
npx convex init
```

### 3.5 Project Structure
After setup, create this file structure:
```
email-automation-system/
├── convex/
│   ├── _generated/          # Auto-generated by Convex
│   ├── schema.ts            # Database schema
│   ├── emails.ts            # Loops.so integration
│   ├── functions.ts         # Triggers + wrapped mutations
│   ├── userLifecycle.ts     # Cron job handlers
│   ├── crons.ts             # Cron schedules
│   ├── http.ts              # Webhook handler
│   └── dashboard.ts         # Dashboard queries
├── app/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Dashboard home
│   ├── logs/
│   │   └── page.tsx         # Email logs page
│   ├── ConvexClientProvider.tsx
│   └── globals.css
├── components/
│   ├── StatCard.tsx
│   ├── EmailVolumeChart.tsx
│   ├── EventTypeChart.tsx
│   ├── LifecycleFunnel.tsx
│   ├── PerformanceTable.tsx
│   ├── EmailLogsTable.tsx
│   └── Navigation.tsx
├── lib/
│   └── utils.ts             # Helper functions
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── next.config.js
├── package.json
└── .env.local
```

### 3.6 Configuration Files

**`tailwind.config.js`**
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
      },
    },
  },
  plugins: [],
}
```

**`next.config.js`**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig
```

**`tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 4. Phase 2: Database Schema

### 4.1 File: `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // USERS TABLE
  // Extended with lifecycle tracking fields
  // ============================================
  users: defineTable({
    // Core identity
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),

    // Subscription info
    plan: v.optional(v.string()),              // "free" | "trial" | "pro" | "enterprise"
    subscriptionStatus: v.optional(v.string()), // "active" | "cancelled" | "past_due"
    trialEndDate: v.optional(v.number()),      // Unix timestamp

    // Activity tracking
    lastActiveAt: v.optional(v.number()),      // Unix timestamp
    onboardingCompleted: v.optional(v.boolean()),
    lifecycleStage: v.optional(v.string()),    // "new" | "onboarding" | "active" | "at_risk" | "churned"

    // Email spam prevention (track when reminders were sent)
    lastInactiveReminderAt: v.optional(v.number()),
    trialEndingReminderSent: v.optional(v.boolean()),
    onboardingReminderSent: v.optional(v.boolean()),

    // Metadata
    createdAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_lifecycleStage", ["lifecycleStage"])
    .index("by_lastActiveAt", ["lastActiveAt"])
    .index("by_subscriptionStatus", ["subscriptionStatus"])
    .index("by_plan", ["plan"]),

  // ============================================
  // EMAIL LOGS TABLE
  // Tracks every individual email sent
  // ============================================
  emailLogs: defineTable({
    // Event identification
    eventName: v.string(),                     // "signup", "inactive_reminder", etc.
    email: v.string(),                         // Recipient email
    userId: v.optional(v.id("users")),         // Link to user if exists

    // Loops.so tracking
    loopsMessageId: v.optional(v.string()),    // From Loops.so response
    transactionalId: v.optional(v.string()),   // If using transactional API

    // Status tracking
    status: v.string(),                        // "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed"

    // Timestamps
    sentAt: v.number(),                        // When we sent it
    deliveredAt: v.optional(v.number()),       // From webhook
    openedAt: v.optional(v.number()),          // From webhook
    clickedAt: v.optional(v.number()),         // From webhook

    // Error handling
    errorMessage: v.optional(v.string()),

    // Additional data
    metadata: v.optional(v.any()),             // Event properties, etc.
  })
    .index("by_eventName", ["eventName"])
    .index("by_status", ["status"])
    .index("by_email", ["email"])
    .index("by_userId", ["userId"])
    .index("by_loopsMessageId", ["loopsMessageId"])
    .index("by_sentAt", ["sentAt"]),

  // ============================================
  // EMAIL STATS TABLE
  // Aggregated daily statistics for fast queries
  // ============================================
  emailStats: defineTable({
    date: v.string(),                          // "2024-01-15" (YYYY-MM-DD)
    eventName: v.string(),                     // "signup", "inactive_reminder", etc.

    // Counters
    sent: v.number(),
    delivered: v.number(),
    opened: v.number(),
    clicked: v.number(),
    bounced: v.number(),
    failed: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_date_eventName", ["date", "eventName"])
    .index("by_eventName", ["eventName"]),
});
```

### 4.2 Schema Design Notes

**Users Table Indexes:**
- `by_email` - Quick lookup by email address
- `by_lifecycleStage` - Filter users by stage for dashboard funnel
- `by_lastActiveAt` - Find inactive users for cron jobs
- `by_subscriptionStatus` - Filter cancelled/active users

**Email Logs Indexes:**
- `by_loopsMessageId` - Critical for webhook updates
- `by_sentAt` - For chronological listing
- `by_eventName` + `by_status` - For filtering in logs page

**Email Stats Compound Index:**
- `by_date_eventName` - Efficient queries for "get stats for date X, event Y"

---

## 5. Phase 3: Email Service (Loops.so)

### 5.1 Loops.so API Reference

**Events API Endpoint:**
```
POST https://app.loops.so/api/v1/events/send
Authorization: Bearer <LOOPS_API_KEY>
Content-Type: application/json
```

**Events API Request Body:**
```json
{
  "email": "user@example.com",
  "eventName": "signup",
  "eventProperties": {
    "plan": "pro",
    "source": "website"
  },
  "firstName": "John",
  "lastName": "Doe"
}
```

**Transactional API Endpoint:**
```
POST https://app.loops.so/api/v1/transactional
Authorization: Bearer <LOOPS_API_KEY>
Content-Type: application/json
```

**Transactional API Request Body:**
```json
{
  "email": "user@example.com",
  "transactionalId": "clxxxxxxxxxxxxxx",
  "dataVariables": {
    "name": "John",
    "resetLink": "https://example.com/reset/abc123"
  }
}
```

### 5.2 File: `convex/emails.ts`

```typescript
import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================
// SEND EVENT (Triggers automation in Loops.so)
// ============================================
export const sendEvent = internalAction({
  args: {
    email: v.string(),
    eventName: v.string(),
    userId: v.optional(v.id("users")),
    eventProperties: v.optional(v.any()),
    contactProperties: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { email, eventName, userId, eventProperties, contactProperties } = args;

    const apiKey = process.env.LOOPS_API_KEY;
    if (!apiKey) {
      console.error("LOOPS_API_KEY not configured");
      await ctx.runMutation(internal.emails.logEmailEvent, {
        eventName,
        email,
        userId,
        status: "failed",
        errorMessage: "LOOPS_API_KEY not configured",
      });
      return;
    }

    try {
      // Build request body
      const body: Record<string, any> = {
        email,
        eventName,
      };

      // Add event properties if provided
      if (eventProperties) {
        body.eventProperties = eventProperties;
      }

      // Add contact properties at top level (Loops.so convention)
      if (contactProperties) {
        Object.assign(body, contactProperties);
      }

      // Call Loops.so Events API
      const response = await fetch("https://app.loops.so/api/v1/events/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}`);
      }

      // Log successful send
      await ctx.runMutation(internal.emails.logEmailEvent, {
        eventName,
        email,
        userId,
        status: "sent",
        loopsMessageId: result.id, // If Loops returns an ID
        metadata: { eventProperties, contactProperties },
      });

      // Update daily stats
      await ctx.runMutation(internal.emails.updateDailyStats, {
        eventName,
        field: "sent",
      });

      console.log(`Email event "${eventName}" sent to ${email}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to send email event "${eventName}" to ${email}:`, errorMessage);

      // Log failed send
      await ctx.runMutation(internal.emails.logEmailEvent, {
        eventName,
        email,
        userId,
        status: "failed",
        errorMessage,
      });

      // Update daily stats for failed
      await ctx.runMutation(internal.emails.updateDailyStats, {
        eventName,
        field: "failed",
      });
    }
  },
});

// ============================================
// SEND TRANSACTIONAL EMAIL (One-off emails)
// ============================================
export const sendTransactionalEmail = internalAction({
  args: {
    email: v.string(),
    transactionalId: v.string(),
    dataVariables: v.optional(v.any()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { email, transactionalId, dataVariables, userId } = args;

    const apiKey = process.env.LOOPS_API_KEY;
    if (!apiKey) {
      console.error("LOOPS_API_KEY not configured");
      return;
    }

    try {
      const body: Record<string, any> = {
        email,
        transactionalId,
      };

      if (dataVariables) {
        body.dataVariables = dataVariables;
      }

      const response = await fetch("https://app.loops.so/api/v1/transactional", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}`);
      }

      // Log successful send
      await ctx.runMutation(internal.emails.logEmailEvent, {
        eventName: `transactional:${transactionalId}`,
        email,
        userId,
        transactionalId,
        status: "sent",
        loopsMessageId: result.id,
        metadata: { dataVariables },
      });

      await ctx.runMutation(internal.emails.updateDailyStats, {
        eventName: `transactional:${transactionalId}`,
        field: "sent",
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to send transactional email to ${email}:`, errorMessage);

      await ctx.runMutation(internal.emails.logEmailEvent, {
        eventName: `transactional:${transactionalId}`,
        email,
        userId,
        transactionalId,
        status: "failed",
        errorMessage,
      });

      await ctx.runMutation(internal.emails.updateDailyStats, {
        eventName: `transactional:${transactionalId}`,
        field: "failed",
      });
    }
  },
});

// ============================================
// LOG EMAIL EVENT (Insert into emailLogs)
// ============================================
export const logEmailEvent = internalMutation({
  args: {
    eventName: v.string(),
    email: v.string(),
    userId: v.optional(v.id("users")),
    loopsMessageId: v.optional(v.string()),
    transactionalId: v.optional(v.string()),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("emailLogs", {
      eventName: args.eventName,
      email: args.email,
      userId: args.userId,
      loopsMessageId: args.loopsMessageId,
      transactionalId: args.transactionalId,
      status: args.status,
      sentAt: Date.now(),
      errorMessage: args.errorMessage,
      metadata: args.metadata,
    });
  },
});

// ============================================
// UPDATE EMAIL STATUS (From webhook)
// ============================================
export const updateEmailStatus = internalMutation({
  args: {
    loopsMessageId: v.string(),
    status: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const { loopsMessageId, status, timestamp } = args;

    // Find the email log by Loops message ID
    const emailLog = await ctx.db
      .query("emailLogs")
      .withIndex("by_loopsMessageId", (q) => q.eq("loopsMessageId", loopsMessageId))
      .first();

    if (!emailLog) {
      console.warn(`Email log not found for loopsMessageId: ${loopsMessageId}`);
      return;
    }

    // Build update object based on status
    const updates: Record<string, any> = { status };

    switch (status) {
      case "delivered":
        updates.deliveredAt = timestamp;
        break;
      case "opened":
        updates.openedAt = timestamp;
        break;
      case "clicked":
        updates.clickedAt = timestamp;
        break;
    }

    await ctx.db.patch(emailLog._id, updates);

    // Update daily stats
    await ctx.runMutation(internal.emails.updateDailyStats, {
      eventName: emailLog.eventName,
      field: status,
      // Use the date from when the email was sent for consistency
      date: new Date(emailLog.sentAt).toISOString().split("T")[0],
    });
  },
});

// ============================================
// UPDATE DAILY STATS (Increment counters)
// ============================================
export const updateDailyStats = internalMutation({
  args: {
    eventName: v.string(),
    field: v.string(), // "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed"
    date: v.optional(v.string()), // If not provided, use today
  },
  handler: async (ctx, args) => {
    const { eventName, field } = args;
    const date = args.date || new Date().toISOString().split("T")[0];

    // Find existing stats record for this date + event
    const existingStats = await ctx.db
      .query("emailStats")
      .withIndex("by_date_eventName", (q) =>
        q.eq("date", date).eq("eventName", eventName)
      )
      .first();

    if (existingStats) {
      // Increment the appropriate field
      const currentValue = (existingStats as any)[field] || 0;
      await ctx.db.patch(existingStats._id, {
        [field]: currentValue + 1,
      });
    } else {
      // Create new stats record
      const newStats: Record<string, any> = {
        date,
        eventName,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        failed: 0,
      };
      newStats[field] = 1;
      await ctx.db.insert("emailStats", newStats as any);
    }
  },
});
```

### 5.3 Email Event Names

| Event Name | Trigger | Description |
|------------|---------|-------------|
| `signup` | User created | Welcome email, getting started guide |
| `subscription_cancelled` | Status → cancelled | Feedback request, win-back offer |
| `plan_upgraded` | Plan tier increased | Thank you, new features overview |
| `inactive_reminder` | 7 days inactive | Re-engagement, feature highlights |
| `trial_ending` | Trial ends in 3 days | Upgrade prompt, value summary |
| `onboarding_incomplete` | 3 days, not completed | Setup help, quick start guide |

---

## 6. Phase 4: Database Triggers

### 6.1 How Triggers Work (convex-helpers)

The `Triggers` class from convex-helpers wraps your database context to detect changes:
- Runs **atomically** within the same transaction as the mutation
- Detects `insert`, `update`, and `delete` operations
- Provides `change.oldDoc` and `change.newDoc` for comparisons
- Use `ctx.scheduler.runAfter(0, ...)` to schedule follow-up actions

### 6.2 File: `convex/functions.ts`

```typescript
import { mutation as rawMutation, internalMutation as rawInternalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { Triggers } from "convex-helpers/server/triggers";
import { customCtx, customMutation } from "convex-helpers/server/customFunctions";
import { v } from "convex/values";

// ============================================
// INITIALIZE TRIGGERS
// ============================================
const triggers = new Triggers<DataModel>();

// ============================================
// TRIGGER 1: User Created → Send "signup" event
// ============================================
triggers.register("users", async (ctx, change) => {
  if (change.operation === "insert" && change.newDoc) {
    const user = change.newDoc;

    // Schedule the email action (runs after mutation commits)
    await ctx.scheduler.runAfter(0, internal.emails.sendEvent, {
      email: user.email,
      eventName: "signup",
      userId: change.id,
      contactProperties: {
        firstName: user.firstName,
        lastName: user.lastName,
      },
      eventProperties: {
        plan: user.plan || "free",
        source: "app",
      },
    });

    console.log(`Trigger: signup event scheduled for ${user.email}`);
  }
});

// ============================================
// TRIGGER 2: Subscription Cancelled
// ============================================
triggers.register("users", async (ctx, change) => {
  if (change.operation === "update" && change.oldDoc && change.newDoc) {
    const oldStatus = change.oldDoc.subscriptionStatus;
    const newStatus = change.newDoc.subscriptionStatus;

    // Only trigger if status changed TO "cancelled"
    if (oldStatus !== "cancelled" && newStatus === "cancelled") {
      await ctx.scheduler.runAfter(0, internal.emails.sendEvent, {
        email: change.newDoc.email,
        eventName: "subscription_cancelled",
        userId: change.id,
        contactProperties: {
          firstName: change.newDoc.firstName,
        },
        eventProperties: {
          previousPlan: change.oldDoc.plan,
          cancelledAt: new Date().toISOString(),
        },
      });

      console.log(`Trigger: subscription_cancelled event scheduled for ${change.newDoc.email}`);
    }
  }
});

// ============================================
// TRIGGER 3: Plan Upgraded
// ============================================
triggers.register("users", async (ctx, change) => {
  if (change.operation === "update" && change.oldDoc && change.newDoc) {
    const planOrder = ["free", "trial", "pro", "enterprise"];
    const oldPlan = change.oldDoc.plan || "free";
    const newPlan = change.newDoc.plan || "free";

    const oldIndex = planOrder.indexOf(oldPlan);
    const newIndex = planOrder.indexOf(newPlan);

    // Only trigger if plan was upgraded (higher index)
    if (newIndex > oldIndex && oldIndex !== -1 && newIndex !== -1) {
      await ctx.scheduler.runAfter(0, internal.emails.sendEvent, {
        email: change.newDoc.email,
        eventName: "plan_upgraded",
        userId: change.id,
        contactProperties: {
          firstName: change.newDoc.firstName,
          plan: newPlan,
        },
        eventProperties: {
          oldPlan,
          newPlan,
          upgradedAt: new Date().toISOString(),
        },
      });

      console.log(`Trigger: plan_upgraded event scheduled for ${change.newDoc.email} (${oldPlan} → ${newPlan})`);
    }
  }
});

// ============================================
// EXPORT WRAPPED MUTATIONS
// These must be used for all user mutations to fire triggers
// ============================================
export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(rawInternalMutation, customCtx(triggers.wrapDB));

// ============================================
// USER MUTATIONS (Use wrapped mutation!)
// ============================================

// Create a new user
export const createUser = mutation({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    plan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      throw new Error("User with this email already exists");
    }

    const userId = await ctx.db.insert("users", {
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      plan: args.plan || "free",
      subscriptionStatus: "active",
      lifecycleStage: "new",
      onboardingCompleted: false,
      createdAt: Date.now(),
    });

    return userId;
  },
});

// Update user subscription status
export const updateSubscriptionStatus = mutation({
  args: {
    userId: v.id("users"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      subscriptionStatus: args.status,
    });
  },
});

// Update user plan
export const updateUserPlan = mutation({
  args: {
    userId: v.id("users"),
    plan: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      plan: args.plan,
    });
  },
});

// Update user activity (call this when user performs actions)
export const updateUserActivity = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastActiveAt: Date.now(),
      lifecycleStage: "active",
    });
  },
});

// Mark onboarding complete
export const completeOnboarding = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      onboardingCompleted: true,
      lifecycleStage: "active",
    });
  },
});
```

### 6.3 Important: Using Wrapped Mutations

**CRITICAL:** For triggers to fire, all mutations that modify the `users` table MUST:
1. Import `mutation` from `./functions.ts` (not from `_generated/server`)
2. Or use the wrapped `internalMutation` from `./functions.ts`

```typescript
// ❌ WRONG - triggers won't fire
import { mutation } from "./_generated/server";

// ✅ CORRECT - triggers will fire
import { mutation } from "./functions";
```

---

## 7. Phase 5: Cron Jobs

### 7.1 Cron Schedule Reference

| Cron Expression | Description |
|-----------------|-------------|
| `0 9 * * *` | Every day at 9:00 AM UTC |
| `0 10 * * *` | Every day at 10:00 AM UTC |
| `0 8 * * 0` | Every Sunday at 8:00 AM UTC |

### 7.2 File: `convex/userLifecycle.ts`

```typescript
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ============================================
// CHECK INACTIVE USERS (Daily at 9 AM UTC)
// Sends "inactive_reminder" to users inactive for 7+ days
// ============================================
export const checkInactiveUsers = internalAction({
  args: {},
  handler: async (ctx) => {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoForReminder = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Query users who:
    // 1. Have lastActiveAt older than 7 days
    // 2. Haven't received an inactive reminder in the last 7 days (spam prevention)
    // 3. Are not churned
    const inactiveUsers = await ctx.runQuery(internal.userLifecycle.getInactiveUsers, {
      inactiveSince: sevenDaysAgo,
      reminderCooldown: sevenDaysAgoForReminder,
    });

    console.log(`Found ${inactiveUsers.length} inactive users to remind`);

    for (const user of inactiveUsers) {
      // Schedule the email
      await ctx.scheduler.runAfter(0, internal.emails.sendEvent, {
        email: user.email,
        eventName: "inactive_reminder",
        userId: user._id,
        contactProperties: {
          firstName: user.firstName,
        },
        eventProperties: {
          lastActiveAt: user.lastActiveAt
            ? new Date(user.lastActiveAt).toISOString()
            : null,
          daysSinceActive: user.lastActiveAt
            ? Math.floor((Date.now() - user.lastActiveAt) / (24 * 60 * 60 * 1000))
            : null,
        },
      });

      // Update the reminder timestamp
      await ctx.runMutation(internal.userLifecycle.markInactiveReminderSent, {
        userId: user._id,
      });
    }

    return { processed: inactiveUsers.length };
  },
});

// ============================================
// CHECK EXPIRING TRIALS (Daily at 10 AM UTC)
// Sends "trial_ending" to users with trials ending in 3 days
// ============================================
export const checkExpiringTrials = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const threeDaysFromNow = now + (3 * 24 * 60 * 60 * 1000);

    // Query users who:
    // 1. Are on trial plan
    // 2. Trial ends within the next 3 days
    // 3. Haven't received the trial ending reminder yet
    const expiringTrials = await ctx.runQuery(internal.userLifecycle.getExpiringTrials, {
      now,
      expirationWindow: threeDaysFromNow,
    });

    console.log(`Found ${expiringTrials.length} expiring trials to notify`);

    for (const user of expiringTrials) {
      const daysRemaining = user.trialEndDate
        ? Math.ceil((user.trialEndDate - now) / (24 * 60 * 60 * 1000))
        : 0;

      await ctx.scheduler.runAfter(0, internal.emails.sendEvent, {
        email: user.email,
        eventName: "trial_ending",
        userId: user._id,
        contactProperties: {
          firstName: user.firstName,
        },
        eventProperties: {
          trialEndDate: user.trialEndDate
            ? new Date(user.trialEndDate).toISOString()
            : null,
          daysRemaining,
        },
      });

      // Mark reminder as sent
      await ctx.runMutation(internal.userLifecycle.markTrialReminderSent, {
        userId: user._id,
      });
    }

    return { processed: expiringTrials.length };
  },
});

// ============================================
// CHECK INCOMPLETE ONBOARDING (Weekly on Sunday 8 AM UTC)
// Sends "onboarding_incomplete" to users who haven't completed after 3 days
// ============================================
export const checkIncompleteOnboarding = internalAction({
  args: {},
  handler: async (ctx) => {
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);

    // Query users who:
    // 1. Have onboardingCompleted = false
    // 2. Created more than 3 days ago
    // 3. Haven't received the onboarding reminder yet
    const incompleteUsers = await ctx.runQuery(internal.userLifecycle.getIncompleteOnboarding, {
      createdBefore: threeDaysAgo,
    });

    console.log(`Found ${incompleteUsers.length} users with incomplete onboarding`);

    for (const user of incompleteUsers) {
      await ctx.scheduler.runAfter(0, internal.emails.sendEvent, {
        email: user.email,
        eventName: "onboarding_incomplete",
        userId: user._id,
        contactProperties: {
          firstName: user.firstName,
        },
        eventProperties: {
          createdAt: user.createdAt
            ? new Date(user.createdAt).toISOString()
            : null,
          daysSinceSignup: user.createdAt
            ? Math.floor((Date.now() - user.createdAt) / (24 * 60 * 60 * 1000))
            : null,
        },
      });

      // Mark reminder as sent
      await ctx.runMutation(internal.userLifecycle.markOnboardingReminderSent, {
        userId: user._id,
      });
    }

    return { processed: incompleteUsers.length };
  },
});

// ============================================
// HELPER QUERIES (Internal)
// ============================================
import { internalQuery, internalMutation } from "./_generated/server";

export const getInactiveUsers = internalQuery({
  args: {
    inactiveSince: v.number(),
    reminderCooldown: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all users and filter
    // Note: For large scale, use pagination or more specific indexes
    const users = await ctx.db.query("users").collect();

    return users.filter((user) => {
      // Must have been active at some point
      if (!user.lastActiveAt) return false;

      // Must be inactive for 7+ days
      if (user.lastActiveAt > args.inactiveSince) return false;

      // Must not have received reminder recently
      if (user.lastInactiveReminderAt && user.lastInactiveReminderAt > args.reminderCooldown) {
        return false;
      }

      // Must not be churned
      if (user.lifecycleStage === "churned") return false;

      // Must have active subscription
      if (user.subscriptionStatus === "cancelled") return false;

      return true;
    });
  },
});

export const getExpiringTrials = internalQuery({
  args: {
    now: v.number(),
    expirationWindow: v.number(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();

    return users.filter((user) => {
      // Must be on trial
      if (user.plan !== "trial") return false;

      // Must have trial end date
      if (!user.trialEndDate) return false;

      // Trial must end within window (3 days from now)
      if (user.trialEndDate > args.expirationWindow) return false;

      // Trial must not have already ended
      if (user.trialEndDate < args.now) return false;

      // Must not have received reminder
      if (user.trialEndingReminderSent) return false;

      return true;
    });
  },
});

export const getIncompleteOnboarding = internalQuery({
  args: {
    createdBefore: v.number(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();

    return users.filter((user) => {
      // Must have onboarding incomplete
      if (user.onboardingCompleted !== false) return false;

      // Must have been created more than 3 days ago
      if (!user.createdAt || user.createdAt > args.createdBefore) return false;

      // Must not have received reminder
      if (user.onboardingReminderSent) return false;

      return true;
    });
  },
});

// ============================================
// HELPER MUTATIONS (Mark reminders sent)
// ============================================
export const markInactiveReminderSent = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastInactiveReminderAt: Date.now(),
      lifecycleStage: "at_risk",
    });
  },
});

export const markTrialReminderSent = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      trialEndingReminderSent: true,
    });
  },
});

export const markOnboardingReminderSent = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      onboardingReminderSent: true,
    });
  },
});
```

### 7.3 File: `convex/crons.ts`

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ============================================
// DAILY: Check for inactive users (9 AM UTC)
// ============================================
crons.cron(
  "check-inactive-users",
  "0 9 * * *",
  internal.userLifecycle.checkInactiveUsers
);

// ============================================
// DAILY: Check for expiring trials (10 AM UTC)
// ============================================
crons.cron(
  "check-expiring-trials",
  "0 10 * * *",
  internal.userLifecycle.checkExpiringTrials
);

// ============================================
// WEEKLY: Check for incomplete onboarding (Sunday 8 AM UTC)
// ============================================
crons.weekly(
  "check-incomplete-onboarding",
  { dayOfWeek: "sunday", hourUTC: 8, minuteUTC: 0 },
  internal.userLifecycle.checkIncompleteOnboarding
);

export default crons;
```

---

## 8. Phase 6: Webhook Handler

### 8.1 Loops.so Webhook Events

| Event Name | Description | Status to Set |
|------------|-------------|---------------|
| `email.delivered` | Email delivered to recipient | `delivered` |
| `email.opened` | Recipient opened email | `opened` |
| `email.clicked` | Recipient clicked link | `clicked` |
| `email.softBounced` | Temporary delivery failure | `bounced` |
| `email.hardBounced` | Permanent delivery failure | `bounced` |

### 8.2 Webhook Payload Structure
```json
{
  "eventName": "email.delivered",
  "eventTime": 1734425918,
  "webhookSchemaVersion": "1.0.0",
  "sourceType": "campaign",
  "campaignId": "cm4t1suns001uw6atri87v54s",
  "email": {
    "id": "cm4t1sseg004tje7982991nan",
    "emailMessageId": "cm4ittv1v001oow9hruou8na8",
    "subject": "Subject of the email"
  },
  "contactIdentity": {
    "id": "cm4ittmhq0011ow9h6fb460yw",
    "email": "test+1@loops.so",
    "userId": null
  }
}
```

### 8.3 File: `convex/http.ts`

```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ============================================
// LOOPS.SO WEBHOOK HANDLER
// Endpoint: POST /loops-webhook
// ============================================
http.route({
  path: "/loops-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      console.log("Received Loops.so webhook:", JSON.stringify(body, null, 2));

      const { eventName, eventTime, email, contactIdentity, transactionalId, campaignId, loopId } = body;

      // Map Loops.so event names to our status values
      const statusMap: Record<string, string> = {
        "email.delivered": "delivered",
        "email.opened": "opened",
        "email.clicked": "clicked",
        "email.softBounced": "bounced",
        "email.hardBounced": "bounced",
      };

      const status = statusMap[eventName];

      if (!status) {
        // Unknown event type, just acknowledge
        console.log(`Unknown webhook event: ${eventName}`);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get the message ID from the email object
      const loopsMessageId = email?.id;

      if (!loopsMessageId) {
        console.warn("No email.id in webhook payload");
        return new Response(JSON.stringify({ error: "Missing email.id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Update the email log status
      await ctx.runMutation(internal.emails.updateEmailStatus, {
        loopsMessageId,
        status,
        timestamp: eventTime * 1000, // Convert to milliseconds
      });

      console.log(`Updated email ${loopsMessageId} to status: ${status}`);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Webhook processing error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// ============================================
// HEALTH CHECK ENDPOINT
// Endpoint: GET /health
// ============================================
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
```

### 8.4 Configuring Webhooks in Loops.so

1. Go to Loops.so Dashboard → Settings → Webhooks
2. Add webhook endpoint: `https://<your-deployment>.convex.site/loops-webhook`
3. Select events to receive:
   - ✅ `email.delivered`
   - ✅ `email.opened`
   - ✅ `email.clicked`
   - ✅ `email.softBounced`
   - ✅ `email.hardBounced`
4. Save and test with the "Send test event" button

---

## 9. Phase 7: Dashboard Queries

### 9.1 File: `convex/dashboard.ts`

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// GET DASHBOARD SUMMARY
// Returns summary cards data
// ============================================
export const getDashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const today = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Get all stats
    const allStats = await ctx.db.query("emailStats").collect();

    // Calculate totals for different periods
    const todayStats = allStats.filter((s) => s.date === today);
    const last7DaysStats = allStats.filter((s) => s.date >= sevenDaysAgo);
    const last30DaysStats = allStats.filter((s) => s.date >= thirtyDaysAgo);

    const sumStats = (stats: typeof allStats) => ({
      sent: stats.reduce((sum, s) => sum + s.sent, 0),
      delivered: stats.reduce((sum, s) => sum + s.delivered, 0),
      opened: stats.reduce((sum, s) => sum + s.opened, 0),
      clicked: stats.reduce((sum, s) => sum + s.clicked, 0),
      bounced: stats.reduce((sum, s) => sum + s.bounced, 0),
      failed: stats.reduce((sum, s) => sum + s.failed, 0),
    });

    const todayTotals = sumStats(todayStats);
    const last7DaysTotals = sumStats(last7DaysStats);
    const last30DaysTotals = sumStats(last30DaysStats);

    // Calculate rates
    const deliveryRate = last30DaysTotals.sent > 0
      ? ((last30DaysTotals.delivered / last30DaysTotals.sent) * 100).toFixed(1)
      : "0.0";

    const openRate = last30DaysTotals.delivered > 0
      ? ((last30DaysTotals.opened / last30DaysTotals.delivered) * 100).toFixed(1)
      : "0.0";

    // Get user counts
    const users = await ctx.db.query("users").collect();
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.lifecycleStage === "active").length;
    const atRiskUsers = users.filter((u) => u.lifecycleStage === "at_risk").length;
    const newUsers = users.filter((u) => u.lifecycleStage === "new").length;

    return {
      today: todayTotals,
      last7Days: last7DaysTotals,
      last30Days: {
        ...last30DaysTotals,
        deliveryRate: parseFloat(deliveryRate),
        openRate: parseFloat(openRate),
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        atRisk: atRiskUsers,
        new: newUsers,
      },
    };
  },
});

// ============================================
// GET DAILY CHART DATA
// Returns time series for line chart
// ============================================
export const getDailyChartData = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const now = Date.now();

    // Generate array of dates
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      dates.push(date.toISOString().split("T")[0]);
    }

    // Get all stats within range
    const startDate = dates[0];
    const allStats = await ctx.db
      .query("emailStats")
      .withIndex("by_date")
      .collect();

    const statsInRange = allStats.filter((s) => s.date >= startDate);

    // Aggregate by date
    const dataByDate = new Map<string, { sent: number; delivered: number; opened: number; clicked: number }>();

    for (const date of dates) {
      dataByDate.set(date, { sent: 0, delivered: 0, opened: 0, clicked: 0 });
    }

    for (const stat of statsInRange) {
      const existing = dataByDate.get(stat.date);
      if (existing) {
        existing.sent += stat.sent;
        existing.delivered += stat.delivered;
        existing.opened += stat.opened;
        existing.clicked += stat.clicked;
      }
    }

    // Convert to array
    return dates.map((date) => ({
      date,
      displayDate: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...dataByDate.get(date)!,
    }));
  },
});

// ============================================
// GET STATS BY EVENT TYPE
// Returns breakdown for bar chart and table
// ============================================
export const getStatsByEventType = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const allStats = await ctx.db.query("emailStats").collect();
    const statsInRange = allStats.filter((s) => s.date >= startDate);

    // Aggregate by event name
    const byEvent = new Map<string, { sent: number; delivered: number; opened: number; clicked: number; bounced: number; failed: number }>();

    for (const stat of statsInRange) {
      const existing = byEvent.get(stat.eventName) || {
        sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, failed: 0,
      };
      existing.sent += stat.sent;
      existing.delivered += stat.delivered;
      existing.opened += stat.opened;
      existing.clicked += stat.clicked;
      existing.bounced += stat.bounced;
      existing.failed += stat.failed;
      byEvent.set(stat.eventName, existing);
    }

    // Convert to array with rates
    return Array.from(byEvent.entries()).map(([eventName, stats]) => ({
      eventName,
      ...stats,
      deliveryRate: stats.sent > 0
        ? parseFloat(((stats.delivered / stats.sent) * 100).toFixed(1))
        : 0,
      openRate: stats.delivered > 0
        ? parseFloat(((stats.opened / stats.delivered) * 100).toFixed(1))
        : 0,
      clickRate: stats.opened > 0
        ? parseFloat(((stats.clicked / stats.opened) * 100).toFixed(1))
        : 0,
    })).sort((a, b) => b.sent - a.sent);
  },
});

// ============================================
// GET LIFECYCLE FUNNEL
// Returns user counts by lifecycle stage
// ============================================
export const getLifecycleFunnel = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    const funnel = {
      total: users.length,
      new: 0,
      onboarding: 0,
      active: 0,
      atRisk: 0,
      churned: 0,
    };

    for (const user of users) {
      switch (user.lifecycleStage) {
        case "new":
          funnel.new++;
          break;
        case "onboarding":
          funnel.onboarding++;
          break;
        case "active":
          funnel.active++;
          break;
        case "at_risk":
          funnel.atRisk++;
          break;
        case "churned":
          funnel.churned++;
          break;
        default:
          // Count as new if no stage set
          funnel.new++;
      }
    }

    return funnel;
  },
});

// ============================================
// GET RECENT EMAIL LOGS
// Returns paginated, filterable logs
// ============================================
export const getRecentEmailLogs = query({
  args: {
    limit: v.optional(v.number()),
    eventName: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    let logsQuery = ctx.db.query("emailLogs").order("desc");

    // Get all and filter (for simplicity; use indexes for production scale)
    let logs = await logsQuery.take(500);

    // Apply filters
    if (args.eventName) {
      logs = logs.filter((log) => log.eventName === args.eventName);
    }
    if (args.status) {
      logs = logs.filter((log) => log.status === args.status);
    }

    // Return limited results
    return logs.slice(0, limit).map((log) => ({
      _id: log._id,
      eventName: log.eventName,
      email: log.email,
      status: log.status,
      sentAt: log.sentAt,
      deliveredAt: log.deliveredAt,
      openedAt: log.openedAt,
      clickedAt: log.clickedAt,
      errorMessage: log.errorMessage,
    }));
  },
});

// ============================================
// GET DISTINCT EVENT NAMES (for filters)
// ============================================
export const getDistinctEventNames = query({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db.query("emailLogs").collect();
    const eventNames = [...new Set(logs.map((log) => log.eventName))];
    return eventNames.sort();
  },
});
```

---

## 10. Phase 8: Next.js Frontend

### 10.1 File: `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #f9fafb;
  --foreground: #111827;
}

body {
  background-color: var(--background);
  color: var(--foreground);
}
```

### 10.2 File: `app/ConvexClientProvider.tsx`

```typescript
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

### 10.3 File: `app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import Navigation from "@/components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Email Lifecycle Dashboard",
  description: "Monitor email automation and user lifecycle",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConvexClientProvider>
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
```

### 10.4 File: `components/Navigation.tsx`

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail, LayoutDashboard, FileText } from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/logs", label: "Logs", icon: FileText },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Mail className="h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-xl font-semibold text-gray-900">
              Email Lifecycle
            </span>
          </div>
          <div className="flex items-center space-x-4">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
```

### 10.5 File: `components/StatCard.tsx`

```typescript
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
}: StatCardProps) {
  const trendColors = {
    up: "text-green-600",
    down: "text-red-600",
    neutral: "text-gray-500",
  };

  const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && trendValue && (
            <p className={`text-sm mt-1 ${trendColors[trend]}`}>
              {trendIcons[trend]} {trendValue}
            </p>
          )}
        </div>
        <div className="p-3 bg-indigo-100 rounded-lg">
          <Icon className="h-6 w-6 text-indigo-600" />
        </div>
      </div>
    </div>
  );
}
```

### 10.6 File: `components/EmailVolumeChart.tsx`

```typescript
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChartData {
  date: string;
  displayDate: string;
  sent: number;
  delivered: number;
  opened: number;
}

interface EmailVolumeChartProps {
  data: ChartData[];
}

export default function EmailVolumeChart({ data }: EmailVolumeChartProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Email Volume (30 Days)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="displayDate"
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="sent"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            name="Sent"
          />
          <Line
            type="monotone"
            dataKey="delivered"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            name="Delivered"
          />
          <Line
            type="monotone"
            dataKey="opened"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            name="Opened"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### 10.7 File: `components/EventTypeChart.tsx`

```typescript
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface EventData {
  eventName: string;
  sent: number;
}

interface EventTypeChartProps {
  data: EventData[];
}

export default function EventTypeChart({ data }: EventTypeChartProps) {
  // Format event names for display
  const formattedData = data.map((item) => ({
    ...item,
    displayName: item.eventName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Emails by Event Type
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={formattedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="displayName"
            tick={{ fontSize: 12 }}
            width={90}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Bar dataKey="sent" fill="#6366f1" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### 10.8 File: `components/LifecycleFunnel.tsx`

```typescript
interface FunnelData {
  total: number;
  new: number;
  onboarding: number;
  active: number;
  atRisk: number;
  churned: number;
}

interface LifecycleFunnelProps {
  data: FunnelData;
}

export default function LifecycleFunnel({ data }: LifecycleFunnelProps) {
  const stages = [
    { key: "total", label: "Total Users", color: "bg-gray-500" },
    { key: "new", label: "New", color: "bg-blue-500" },
    { key: "onboarding", label: "Onboarding", color: "bg-indigo-500" },
    { key: "active", label: "Active", color: "bg-green-500" },
    { key: "atRisk", label: "At Risk", color: "bg-yellow-500" },
    { key: "churned", label: "Churned", color: "bg-red-500" },
  ];

  const maxValue = data.total || 1;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        User Lifecycle Funnel
      </h3>
      <div className="space-y-3">
        {stages.map((stage) => {
          const value = data[stage.key as keyof FunnelData];
          const percentage = ((value / maxValue) * 100).toFixed(1);
          const barWidth = Math.max((value / maxValue) * 100, 2);

          return (
            <div key={stage.key} className="flex items-center">
              <div className="w-24 text-sm text-gray-600">{stage.label}</div>
              <div className="flex-1 mx-4">
                <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${stage.color} rounded-lg transition-all duration-500`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
              <div className="w-20 text-right">
                <span className="font-semibold text-gray-900">{value}</span>
                <span className="text-sm text-gray-500 ml-1">({percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 10.9 File: `components/PerformanceTable.tsx`

```typescript
interface EventStats {
  eventName: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
}

interface PerformanceTableProps {
  data: EventStats[];
}

export default function PerformanceTable({ data }: PerformanceTableProps) {
  const formatEventName = (name: string) =>
    name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const getRateColor = (rate: number) => {
    if (rate >= 25) return "text-green-600 bg-green-100";
    if (rate >= 15) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Event Performance (30 Days)
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sent
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Delivered
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Opened
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Open Rate
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Click Rate
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((event) => (
              <tr key={event.eventName} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatEventName(event.eventName)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                  {event.sent.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                  {event.delivered.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                  {event.opened.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRateColor(event.openRate)}`}
                  >
                    {event.openRate}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRateColor(event.clickRate)}`}
                  >
                    {event.clickRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### 10.10 File: `app/page.tsx` (Dashboard Home)

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Mail, TrendingUp, MousePointer, Users } from "lucide-react";
import StatCard from "@/components/StatCard";
import EmailVolumeChart from "@/components/EmailVolumeChart";
import EventTypeChart from "@/components/EventTypeChart";
import LifecycleFunnel from "@/components/LifecycleFunnel";
import PerformanceTable from "@/components/PerformanceTable";

export default function DashboardPage() {
  const summary = useQuery(api.dashboard.getDashboardSummary);
  const chartData = useQuery(api.dashboard.getDailyChartData, { days: 30 });
  const eventStats = useQuery(api.dashboard.getStatsByEventType, { days: 30 });
  const funnelData = useQuery(api.dashboard.getLifecycleFunnel);

  // Loading state
  if (!summary || !chartData || !eventStats || !funnelData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Emails Sent (30d)"
          value={summary.last30Days.sent.toLocaleString()}
          subtitle={`${summary.today.sent} today`}
          icon={Mail}
        />
        <StatCard
          title="Delivery Rate"
          value={`${summary.last30Days.deliveryRate}%`}
          icon={TrendingUp}
          trend={summary.last30Days.deliveryRate >= 95 ? "up" : "down"}
        />
        <StatCard
          title="Open Rate"
          value={`${summary.last30Days.openRate}%`}
          icon={MousePointer}
          trend={summary.last30Days.openRate >= 20 ? "up" : "neutral"}
        />
        <StatCard
          title="Active Users"
          value={summary.users.active.toLocaleString()}
          subtitle={`${summary.users.atRisk} at risk`}
          icon={Users}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EmailVolumeChart data={chartData} />
        <EventTypeChart data={eventStats} />
      </div>

      {/* Lifecycle Funnel */}
      <LifecycleFunnel data={funnelData} />

      {/* Performance Table */}
      <PerformanceTable data={eventStats} />
    </div>
  );
}
```

### 10.11 File: `components/EmailLogsTable.tsx`

```typescript
"use client";

import { formatDistanceToNow } from "date-fns";

interface EmailLog {
  _id: string;
  eventName: string;
  email: string;
  status: string;
  sentAt: number;
  errorMessage?: string;
}

interface EmailLogsTableProps {
  logs: EmailLog[];
}

export default function EmailLogsTable({ logs }: EmailLogsTableProps) {
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      sent: "bg-blue-100 text-blue-800",
      delivered: "bg-green-100 text-green-800",
      opened: "bg-purple-100 text-purple-800",
      clicked: "bg-indigo-100 text-indigo-800",
      bounced: "bg-red-100 text-red-800",
      failed: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  const formatEventName = (name: string) =>
    name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Error
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDistanceToNow(new Date(log.sentAt), { addSuffix: true })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-800">
                    {formatEventName(log.eventName)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(log.status)}`}
                  >
                    {log.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">
                  {log.errorMessage || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### 10.12 File: `app/logs/page.tsx` (Email Logs Page)

```typescript
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import EmailLogsTable from "@/components/EmailLogsTable";

export default function LogsPage() {
  const [eventFilter, setEventFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const eventNames = useQuery(api.dashboard.getDistinctEventNames);
  const logs = useQuery(api.dashboard.getRecentEmailLogs, {
    limit: 100,
    eventName: eventFilter || undefined,
    status: statusFilter || undefined,
  });

  const statuses = ["sent", "delivered", "opened", "clicked", "bounced", "failed"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Logs</h1>
        <p className="text-gray-500 mt-1">View all sent emails and their status</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Events</option>
          {eventNames?.map((name) => (
            <option key={name} value={name}>
              {name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {!logs ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No email logs found</p>
        </div>
      ) : (
        <EmailLogsTable logs={logs} />
      )}
    </div>
  );
}
```

---

## 11. Phase 9: Environment & Deployment

### 11.1 Set Convex Environment Variables

```bash
# Set your Loops.so API key in Convex
npx convex env set LOOPS_API_KEY your_loops_api_key_here
```

### 11.2 Create `.env.local` for Next.js

```bash
# .env.local
NEXT_PUBLIC_CONVEX_URL=https://your-deployment-name.convex.cloud
```

Get your Convex URL from the terminal output after running `npx convex dev`.

### 11.3 Development Mode

**Terminal 1: Run Convex**
```bash
npx convex dev
```

**Terminal 2: Run Next.js**
```bash
npm run dev
```

Visit: http://localhost:3000

### 11.4 Production Deployment

**Deploy Convex:**
```bash
npx convex deploy
```

**Deploy to Vercel:**
```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Deploy
vercel

# Set environment variable
vercel env add NEXT_PUBLIC_CONVEX_URL
```

### 11.5 Configure Loops.so Webhooks

1. Go to: https://app.loops.so/settings?page=webhooks
2. Add endpoint URL: `https://your-convex-deployment.convex.site/loops-webhook`
3. Select events:
   - Email delivered
   - Email opened
   - Email clicked
   - Email soft bounced
   - Email hard bounced
4. Click "Save"
5. Use "Send test event" to verify

---

## 12. Testing Checklist

### 12.1 Trigger Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Signup trigger | Create new user via mutation | "signup" event sent to Loops.so, log created |
| Cancellation trigger | Update user subscriptionStatus to "cancelled" | "subscription_cancelled" event sent |
| Upgrade trigger | Update user plan from "free" to "pro" | "plan_upgraded" event sent |

### 12.2 Cron Job Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Inactive users | Set user lastActiveAt > 7 days ago, wait for cron | "inactive_reminder" sent, timestamp updated |
| Expiring trials | Set user trialEndDate to 2 days from now | "trial_ending" sent, flag set |
| Incomplete onboarding | Create user with onboardingCompleted: false, wait 3+ days | "onboarding_incomplete" sent |

### 12.3 Webhook Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Delivery webhook | Send test from Loops.so dashboard | Log status updated to "delivered" |
| Open webhook | Open test email | Log status updated to "opened" |
| Click webhook | Click link in test email | Log status updated to "clicked" |

### 12.4 Dashboard Tests

| Test | Expected Result |
|------|-----------------|
| Summary cards load | Shows emails sent, delivery rate, open rate, active users |
| Line chart renders | Shows 30-day email volume trend |
| Bar chart renders | Shows emails by event type |
| Funnel displays | Shows user lifecycle stages |
| Logs page filters | Filtering by event/status works |
| Real-time updates | Dashboard updates when new data arrives |

---

## Quick Reference: File List

```
convex/
├── schema.ts           # Database tables: users, emailLogs, emailStats
├── emails.ts           # sendEvent, sendTransactionalEmail, logEmailEvent, updateEmailStatus, updateDailyStats
├── functions.ts        # Triggers + wrapped mutations (createUser, updateSubscriptionStatus, etc.)
├── userLifecycle.ts    # Cron handlers + helper queries/mutations
├── crons.ts            # Cron schedule definitions
├── http.ts             # Webhook handler (/loops-webhook)
└── dashboard.ts        # Dashboard queries

app/
├── layout.tsx
├── page.tsx            # Dashboard home
├── logs/page.tsx       # Email logs
├── globals.css
└── ConvexClientProvider.tsx

components/
├── Navigation.tsx
├── StatCard.tsx
├── EmailVolumeChart.tsx
├── EventTypeChart.tsx
├── LifecycleFunnel.tsx
├── PerformanceTable.tsx
└── EmailLogsTable.tsx
```

---

## Summary

This implementation guide provides a complete, production-ready email automation system that:

1. **Triggers emails automatically** when users sign up, cancel, or upgrade (via convex-helpers Triggers)
2. **Runs scheduled checks** for inactive users, expiring trials, and incomplete onboarding (via Convex cron jobs)
3. **Tracks all email activity** with delivery/open/click status (via Loops.so webhooks)
4. **Provides real-time dashboard** with charts, funnel, and filterable logs (via Next.js + Convex + Recharts)

All automation logic runs inside Convex - no external services required beyond Loops.so for email delivery.
