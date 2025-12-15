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
      const body: Record<string, unknown> = {
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
        loopsMessageId: result.id,
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
      const body: Record<string, unknown> = {
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
    const updates: Record<string, unknown> = { status };

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
    field: v.string(),
    date: v.optional(v.string()),
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
      type StatsFields = "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed";
      const statsField = field as StatsFields;
      const currentValue = existingStats[statsField] || 0;
      await ctx.db.patch(existingStats._id, {
        [field]: currentValue + 1,
      });
    } else {
      // Create new stats record
      const newStats: Record<string, unknown> = {
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
      await ctx.db.insert("emailStats", newStats as {
        date: string;
        eventName: string;
        sent: number;
        delivered: number;
        opened: number;
        clicked: number;
        bounced: number;
        failed: number;
      });
    }
  },
});
