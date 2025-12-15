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

// Get all users (for admin/dashboard)
export const getAllUsers = rawMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});
