# Quick Start Guide

The Email Lifecycle Automation System is fully implemented! Follow these steps to run it.

## Prerequisites

- Node.js 18+
- A Convex account (free at https://convex.dev)
- A Loops.so account (free at https://loops.so)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Convex

```bash
# Login to Convex (opens browser)
npx convex login

# Start Convex dev server (this generates types and creates deployment)
npx convex dev
```

After running `npx convex dev`, you'll see output like:
```
✔ Connected to https://your-deployment-name.convex.cloud
```

**Keep this terminal running!**

## Step 3: Configure Environment

Create a `.env.local` file with your Convex URL:

```bash
# Copy the URL from the convex dev output
echo "NEXT_PUBLIC_CONVEX_URL=https://your-deployment-name.convex.cloud" > .env.local
```

## Step 4: Set Loops.so API Key

```bash
# Get your API key from: https://app.loops.so/settings?page=api
npx convex env set LOOPS_API_KEY your_loops_api_key_here
```

## Step 5: Run Next.js

Open a **new terminal** and run:

```bash
npm run dev
```

Visit http://localhost:3000

## Step 6: Configure Loops.so Webhooks

1. Go to https://app.loops.so/settings?page=webhooks
2. Add webhook URL: `https://your-deployment-name.convex.site/loops-webhook`
3. Select events: delivered, opened, clicked, softBounced, hardBounced
4. Save and test

## Testing the System

### Create a Test User (via Convex Dashboard)

1. Go to your Convex dashboard (link shown in `npx convex dev` output)
2. Click "Functions" → find `functions:createUser`
3. Run with test data:
   ```json
   {
     "email": "test@example.com",
     "firstName": "Test",
     "plan": "free"
   }
   ```
4. Check your Loops.so dashboard for the "signup" event
5. Check the Email Logs page in your dashboard

### Test Subscription Cancellation

1. In Convex Dashboard, run `functions:updateSubscriptionStatus`:
   ```json
   {
     "userId": "<user_id_from_step_above>",
     "status": "cancelled"
   }
   ```
2. Check for "subscription_cancelled" event in Loops.so

## Project Structure

```
├── convex/                    # Backend (Convex)
│   ├── schema.ts             # Database schema
│   ├── emails.ts             # Loops.so integration
│   ├── functions.ts          # Database triggers
│   ├── userLifecycle.ts      # Cron job handlers
│   ├── crons.ts              # Cron schedules
│   ├── http.ts               # Webhook endpoint
│   └── dashboard.ts          # Dashboard queries
├── app/                       # Frontend (Next.js)
│   ├── page.tsx              # Dashboard home
│   ├── logs/page.tsx         # Email logs
│   └── layout.tsx            # App layout
└── components/                # React components
    ├── EmailVolumeChart.tsx
    ├── EventTypeChart.tsx
    ├── LifecycleFunnel.tsx
    └── ...
```

## Automated Email Events

| Trigger | Event Name | When |
|---------|------------|------|
| User signup | `signup` | User created |
| Subscription cancelled | `subscription_cancelled` | Status → cancelled |
| Plan upgraded | `plan_upgraded` | Plan tier increased |
| Inactive user | `inactive_reminder` | Daily cron, 7+ days inactive |
| Trial ending | `trial_ending` | Daily cron, trial ends in 3 days |
| Incomplete onboarding | `onboarding_incomplete` | Weekly cron, 3+ days since signup |

## Production Deployment

```bash
# Deploy Convex to production
npx convex deploy

# Deploy to Vercel
vercel
vercel env add NEXT_PUBLIC_CONVEX_URL
```

## Troubleshooting

**Build fails with "No address provided"**
- Make sure `.env.local` has `NEXT_PUBLIC_CONVEX_URL` set
- Run `npx convex dev` first to get the URL

**Emails not sending**
- Check `LOOPS_API_KEY` is set: `npx convex env list`
- Check Convex logs for errors

**Webhooks not updating status**
- Verify webhook URL in Loops.so settings
- Check `/health` endpoint: `curl https://your-deployment.convex.site/health`
