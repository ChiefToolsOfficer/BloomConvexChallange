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

      const { eventName, eventTime, email } = body;

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
