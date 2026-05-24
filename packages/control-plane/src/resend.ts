const RESEND_URL = "https://api.resend.com/emails";

export type WelcomeEmail = {
  to: string;
  apiKey: string;
};

export type SendResult =
  | { sent: true }
  | { sent: false; reason: string };

export async function sendWelcomeEmail(input: WelcomeEmail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY not set" };
  }
  const from = process.env.RESEND_FROM ?? "Relay <onboarding@resend.dev>";

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background:#020617; color:#f1f5f9; padding:24px;">
    <div style="max-width:520px; margin:0 auto;">
      <h2 style="margin:0 0 16px 0;">Welcome to Relay 👋</h2>
      <p style="color:#94a3b8;">Your tenant API key:</p>
      <pre style="background:#0f172a; padding:14px; border-radius:8px; color:#34d399; overflow-x:auto; font-size:13px;">${input.apiKey}</pre>
      <p style="color:#94a3b8;">Save it — Relay can't show it again.</p>
      <hr style="border:none; border-top:1px solid #1e293b; margin:24px 0;" />
      <p style="color:#94a3b8;">Get started in your code:</p>
      <pre style="background:#0f172a; padding:14px; border-radius:8px; color:#f1f5f9; overflow-x:auto; font-size:13px;">npm install @relayhq/sdk

import { createAgent } from "@relayhq/sdk";

const agent = createAgent({
  apiKey: process.env.RELAY_API_KEY,
  baseUrl: "${process.env.PUBLIC_RELAY_URL ?? "https://relay-api.fly.dev"}",
  model: "gpt-4o-mini",
});</pre>
      <p style="color:#64748b; font-size:12px; margin-top:24px;">
        Docs: <a href="https://github.com/KevinCorrea5103/relay" style="color:#34d399;">github.com/KevinCorrea5103/relay</a>
      </p>
    </div>
  </body>
</html>`;

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: "Your Relay API key",
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { sent: false, reason: `resend ${res.status}: ${text.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
