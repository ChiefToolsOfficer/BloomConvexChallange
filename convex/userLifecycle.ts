import { internalAction, internalQuery, internalMutation } from "./_generated/server";
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
