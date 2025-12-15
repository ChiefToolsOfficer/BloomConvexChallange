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
