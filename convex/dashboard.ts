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

    const logsQuery = ctx.db.query("emailLogs").order("desc");

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
