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
