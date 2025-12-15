# Quick Start: Building in Cursor

## Step 1: Initial Setup

Open Cursor and create a new project folder. Then paste this in the terminal:

```bash
# Create project structure
mkdir -p convex app/logs

# Initialize npm and install dependencies
npm init -y
npm install convex convex-helpers loops next react react-dom recharts lucide-react date-fns
npm install -D typescript @types/react @types/node tailwindcss postcss autoprefixer

# Initialize Tailwind
npx tailwindcss init -p

# Login to Convex
npx convex login

# Initialize Convex in this project
npx convex init
```

## Step 2: Give Cursor Context

1. Copy the `CURSOR_PROMPT.md` file into your project root
2. Copy the `.cursorrules` file into your project root
3. Open Cursor's chat (Cmd+L or Ctrl+L)

## Step 3: First Prompt to Cursor

Paste this exact prompt:

---

**Prompt 1: Schema & Email Service**

```
Read the CURSOR_PROMPT.md file in this project for full context.

Start by creating these files:

1. `convex/schema.ts` - Database schema with:
   - users table (with lifecycle fields: plan, subscriptionStatus, lastActiveAt, onboardingCompleted, reminder timestamps)
   - emailLogs table (eventName, email, userId, status, timestamps)
   - emailStats table (date, eventName, sent/delivered/opened/clicked/bounced/failed counts)
   - Add all necessary indexes

2. `convex/emails.ts` - Loops.so integration with:
   - sendEvent internal action (calls Loops API, logs to database)
   - sendTransactionalEmail internal action
   - logEmailEvent internal mutation
   - updateEmailStatus internal mutation (for webhooks)
   - updateDailyStats internal mutation

Use the Loops.so API endpoint: POST https://app.loops.so/api/v1/events/send
API key from: process.env.LOOPS_API_KEY

Make sure all emails are logged to the emailLogs table and stats are updated.
```

---

**Prompt 2: Triggers & Crons**

```
Now create the automation logic:

1. `convex/functions.ts` - Database triggers using convex-helpers:
   - Import Triggers from "convex-helpers/server/triggers"
   - Register triggers on "users" table for:
     - insert → send "signup" event
     - update (subscriptionStatus → cancelled) → send "subscription_cancelled"
     - update (plan changed) → send "plan_upgraded"
   - Export wrapped mutation and internalMutation that fire triggers

2. `convex/userLifecycle.ts` - Cron job handlers:
   - checkInactiveUsers: find users with lastActiveAt > 7 days, send "inactive_reminder"
   - checkExpiringTrials: find users with trialEndDate within 3 days, send "trial_ending"
   - checkIncompleteOnboarding: find users with onboardingCompleted: false after 3 days
   - Include spam prevention (check lastReminderAt before sending)
   - Mark reminder timestamps after sending

3. `convex/crons.ts` - Schedule definitions:
   - check-inactive-users: daily 9 AM UTC
   - check-expiring-trials: daily 10 AM UTC
   - check-incomplete-onboarding: weekly Sunday 8 AM UTC

4. `convex/http.ts` - Webhook handler:
   - POST /loops-webhook to receive delivery events from Loops.so
   - Update emailLogs status based on event type
```

---

**Prompt 3: Dashboard Queries**

```
Create the dashboard data layer:

`convex/dashboard.ts` with these queries:

1. getDashboardSummary - returns:
   - today's stats (sent, delivered, opened)
   - last 7 days stats
   - last 30 days stats with rates (deliveryRate, openRate)
   - user counts (total, active, atRisk)

2. getDailyChartData(days: number) - returns:
   - Array of { date, sent, delivered, opened } for last N days
   - Fill in zeros for days with no data

3. getStatsByEventType(days: number) - returns:
   - Array of { eventName, sent, delivered, opened, openRate, clickRate }

4. getLifecycleFunnel - returns:
   - { total, new, onboarding, active, atRisk, churned }
   - Calculate stages based on user fields

5. getRecentEmailLogs(limit, eventName?, status?) - returns:
   - Filterable, paginated email logs
   - Most recent first
```

---

**Prompt 4: Next.js Setup**

```
Set up the Next.js frontend:

1. `next.config.js` - basic config

2. `tailwind.config.js` - configure content paths for app/ directory

3. `tsconfig.json` - Next.js TypeScript config

4. `app/globals.css` - Tailwind imports (@tailwind base, components, utilities)

5. `app/ConvexClientProvider.tsx` - Client component that wraps ConvexProvider

6. `app/layout.tsx` - Root layout with:
   - ConvexClientProvider wrapper
   - Navigation bar (Dashboard, Logs, Users links)
   - Basic styling
```

---

**Prompt 5: Dashboard Page**

```
Create the main dashboard page at `app/page.tsx`:

Use useQuery to fetch:
- api.dashboard.getDashboardSummary
- api.dashboard.getDailyChartData
- api.dashboard.getStatsByEventType
- api.dashboard.getLifecycleFunnel

Build these components:
1. StatCard - shows metric with title, value, and optional trend
2. LifecycleFunnel - horizontal bar visualization of user stages

Layout:
- 4 stat cards in a row (Emails Sent, Delivery Rate, Open Rate, Active Users)
- 2 charts side by side (Line chart for volume, Bar chart for event types)
- Lifecycle funnel full width
- Performance table with all events

Use Recharts for:
- LineChart with lines for sent, delivered, opened
- BarChart (horizontal/vertical) for event breakdown

Add loading state while queries are pending.
```

---

**Prompt 6: Logs Page**

```
Create the email logs page at `app/logs/page.tsx`:

Features:
- Filter dropdowns for eventName and status
- Table showing: Time (relative), Event (badge), Email, Status (colored badge), Error

Use:
- useQuery(api.dashboard.getRecentEmailLogs, { filters })
- date-fns formatDistanceToNow for relative times
- Colored badges for status (blue=sent, green=delivered, purple=opened, red=failed)

The filters should be controlled state that updates the query args.
```

---

## Step 4: Environment Setup

After Cursor generates the code:

```bash
# Set your Loops API key
npx convex env set LOOPS_API_KEY your_actual_api_key_here

# Create .env.local
echo "NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud" > .env.local
```

Get your Convex URL from the terminal output after running `npx convex dev`.

## Step 5: Run & Test

```bash
# Terminal 1: Convex
npx convex dev

# Terminal 2: Next.js
npm run dev
```

Visit http://localhost:3000

## Step 6: Deploy

```bash
# Deploy Convex backend
npx convex deploy

# Deploy to Vercel
vercel
vercel env add NEXT_PUBLIC_CONVEX_URL
```

## Troubleshooting Prompts

If something isn't working, use these follow-up prompts:

**"The triggers aren't firing"**
```
Check convex/functions.ts - make sure the mutation export uses customMutation wrapper and imports rawMutation from _generated/server. Show me the file.
```

**"Emails aren't being logged"**
```
In convex/emails.ts, the sendEvent action should call ctx.runMutation(internal.emails.logEmailEvent, {...}) after the API call. Show me the sendEvent function.
```

**"Dashboard shows no data"**
```
Check that convex/dashboard.ts queries are correctly reading from emailStats and emailLogs tables. Also verify the schema indexes are set up correctly.
```

**"Charts not rendering"**
```
Make sure recharts is imported correctly and the data format matches what the chart expects. Show me the chart component code.
```
