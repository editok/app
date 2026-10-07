import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SENDER = "EDITOK Support <support@editok.in>";

const escapeHtml = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const normalizeLineBreaks = (text: string): string => text
  .replaceAll('\\r\\n', '\n')
  .replaceAll('\\n', '\n')
  .replaceAll('\\r', '\n')
  .replaceAll('\r\n', '\n')
  .replaceAll('\r', '\n');

const textToHtml = (text: string): string => {
  const escaped = escapeHtml(normalizeLineBreaks(text));
  return escaped
    .replaceAll("\n\n", "</p><p>")
    .replaceAll("\n", "<br>")
    .trim();
};

const wrapHtml = (bodyText: string): string => `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f7fb;color:#182230;font-family:Arial,Helvetica,sans-serif;line-height:1.5">
    <div style="max-width:640px;margin:0 auto;padding:32px 16px">
      <div style="background:#102a43;border-radius:16px 16px 0 0;padding:24px 32px;color:#fff">
        <div style="font-size:24px;font-weight:700;letter-spacing:.08em">EDITOK</div>
        <div style="font-size:12px;color:#b9d4ef;margin-top:4px">Creative workflow, delivered clearly.</div>
      </div>
      <div style="background:#fff;border:1px solid #dce5ef;border-top:0;border-radius:0 0 16px 16px;padding:32px">
        <p style="margin:0 0 16px;color:#526579;font-size:15px;white-space:pre-wrap">${textToHtml(bodyText)}</p>
        <p style="margin:28px 0 0;color:#8a9aaa;font-size:12px">This is an automated message from EDITOK. Please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json() as {
      campaignId: string;
      subject: string;
      bodyContent: string;
      recipients: { email: string; name: string | null }[];
    };

    if (!body.campaignId || !body.subject || !body.bodyContent || !body.recipients?.length) {
      return new Response(JSON.stringify({ error: "campaignId, subject, bodyContent, and recipients are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    if (!smtpPassword) throw new Error("SMTP_PASSWORD is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Mark campaign as sending
    await supabase.from("broadcast_campaigns").update({
      status: "sending",
      recipient_count: body.recipients.length,
    }).eq("id", body.campaignId);

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "support@editok.in", pass: smtpPassword },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of body.recipients) {
      try {
        const personalizedBody = normalizeLineBreaks(body.bodyContent
          .replaceAll("{{name}}", recipient.name || "")
          .replaceAll("{{email}}", recipient.email));

        await transporter.sendMail({
          from: SENDER,
          to: recipient.email,
          subject: body.subject,
          html: wrapHtml(personalizedBody),
          text: personalizedBody,
        });

        await supabase.from("email_logs").insert({
          template_name: "broadcast",
          recipient_email: recipient.email,
          recipient_name: recipient.name || null,
          subject: body.subject,
          body_content: personalizedBody,
          variables: JSON.stringify({ campaignId: body.campaignId }),
          status: "sent",
        });

        sentCount++;
      } catch (err) {
        console.error(`[broadcast] Failed for ${recipient.email}:`, err);
        failedCount++;
      }
    }

    // Update campaign with final counts
    await supabase.from("broadcast_campaigns").update({
      status: "sent",
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: new Date().toISOString(),
    }).eq("id", body.campaignId);

    return new Response(JSON.stringify({
      sent: true,
      sentCount,
      failedCount,
      total: body.recipients.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Broadcast email failed";
    console.error("send-broadcast-email error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
