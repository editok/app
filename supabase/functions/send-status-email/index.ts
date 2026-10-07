import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SENDER = "EDITOK Support <support@editok.in>";
const FALLBACK_BRAND = {
  name: "EDITOK",
  slogan: "Creative workflow, delivered clearly.",
  logoUrl: "",
  primaryColor: "#3b82f6",
};

interface EmailRequest {
  templateName: string;
  recipient: string;
  recipientName?: string | null;
  variables?: Record<string, string>;
  rawSubject?: string;
  rawBody?: string;
}

interface BrandSettings {
  name?: string;
  slogan?: string;
  logoUrl?: string;
  primaryColor?: string;
}

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

const renderTemplate = (template: string, variables: Record<string, string>): string => {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value || "");
  }
  return normalizeLineBreaks(result.replaceAll(/\{\{[^}]+\}\}/g, ""));
};

const formatAmount = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined || amount === "") return "";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return String(amount);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(num);
};

const renderBody = (text: string): string => {
  const withoutGreeting = text.trim().replace(/^(hi|hello)\b(?:\s+[^,\n]+)?[,!:]?\s*/i, "");
  const escaped = escapeHtml(withoutGreeting);
  const linkify = (value: string): string => value.replace(/(https?:\/\/[^\s<]+|mailto:[^\s<]+)/g, (url) => `<a href="${url}" style="color:#75b7ff;text-decoration:none;font-weight:700">${url}</a>`);
  return escaped
    .split(/\n\s*\n/)
    .map((paragraph) => `<p style="margin:0 0 18px;color:#c7d2e2;font-size:15px;line-height:1.7">${linkify(paragraph.replaceAll("\n", "<br>"))}</p>`)
    .join("");
};

const getBrandSettings = async (supabase: ReturnType<typeof createClient>): Promise<typeof FALLBACK_BRAND> => {
  const { data } = await supabase.from("settings").select("value").eq("key", "branding").maybeSingle();
  const value = (data?.value || {}) as BrandSettings;
  return {
    name: value.name?.trim() || FALLBACK_BRAND.name,
    slogan: value.slogan?.trim() || FALLBACK_BRAND.slogan,
    logoUrl: value.logoUrl?.trim() || FALLBACK_BRAND.logoUrl,
    primaryColor: /^#[0-9a-fA-F]{6}$/.test(value.primaryColor || "") ? value.primaryColor! : FALLBACK_BRAND.primaryColor,
  };
};

const renderEmailHtml = (body: string, brand: typeof FALLBACK_BRAND, recipientName: string | null, variables: Record<string, string>): string => {
  const safeName = escapeHtml(recipientName || variables.customer_name || variables.editor_name || "there");
  const logo = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" style="display:block;max-width:190px;max-height:54px;width:auto;height:auto;margin:0 auto 10px">`
    : `<div style="font-size:28px;font-weight:800;letter-spacing:.08em;color:#f8fafc">${escapeHtml(brand.name)}</div>`;

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#07111f;color:#f8fafc;font-family:Arial,Helvetica,sans-serif">
    <div style="width:100%;background:#07111f;padding:36px 12px">
      <div style="max-width:620px;margin:0 auto">
        <div style="text-align:center;padding:18px 20px 26px">
          ${logo}
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${brand.primaryColor};font-weight:700">${escapeHtml(brand.slogan)}</div>
        </div>
        <div style="background:#101b2a;border:1px solid #26364b;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.3)">
          <div style="height:4px;background:${brand.primaryColor}"></div>
          <div style="padding:34px 34px 28px">
            <p style="margin:0 0 22px;color:#f8fafc;font-size:15px;font-weight:700">Hi ${safeName},</p>
            ${renderBody(body)}
          </div>
          <div style="border-top:1px solid #26364b;padding:22px 34px 26px">
            <p style="margin:0;color:#94a6bb;font-size:12px;line-height:1.6">Need help? Reply directly to <a href="mailto:support@editok.in" style="color:${brand.primaryColor};text-decoration:none;font-weight:700">support@editok.in</a></p>
          </div>
        </div>
        <div style="text-align:center;padding:24px 20px 8px;color:#71839a;font-size:11px;line-height:1.7">
          <div style="margin-bottom:4px">© ${new Date().getFullYear()} ${escapeHtml(brand.name)}. All rights reserved.</div>
          <div>This is an automated message from ${escapeHtml(brand.name)}.</div>
        </div>
      </div>
    </div>
  </body>
</html>`;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json() as EmailRequest;
    if (!body.recipient) {
      return new Response(JSON.stringify({ error: "recipient is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    if (!smtpPassword) throw new Error("SMTP_PASSWORD is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const variables: Record<string, string> = { ...(body.variables || {}) };
    if (body.recipientName) variables.customer_name = variables.customer_name || body.recipientName;
    if (variables.amount) variables.amount = formatAmount(variables.amount);

    let subject: string;
    let textBody: string;
    const logTemplateName = body.templateName || "broadcast";

    if (body.rawSubject != null && body.rawBody != null) {
      subject = renderTemplate(body.rawSubject, variables);
      textBody = renderTemplate(body.rawBody, variables);
    } else {
      if (!body.templateName) {
        return new Response(JSON.stringify({ error: "templateName is required when rawSubject/rawBody are not provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: template, error: tplError } = await supabase
        .from("email_templates")
        .select("subject, body_content, enabled")
        .eq("template_name", body.templateName)
        .maybeSingle();
      if (tplError) throw new Error(`Failed to fetch template: ${tplError.message}`);
      if (!template) throw new Error(`Email template "${body.templateName}" not found`);
      if (!template.enabled) {
        return new Response(JSON.stringify({ sent: false, reason: "template disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      subject = renderTemplate(template.subject, variables);
      textBody = renderTemplate(template.body_content, variables);
    }

    const brand = await getBrandSettings(supabase);
    const htmlBody = renderEmailHtml(textBody, brand, body.recipientName || null, variables);
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "support@editok.in", pass: smtpPassword },
    });

    await transporter.sendMail({ from: SENDER, to: body.recipient, subject, html: htmlBody, text: textBody });
    await supabase.from("email_logs").insert({
      template_name: logTemplateName,
      recipient_email: body.recipient,
      recipient_name: body.recipientName || null,
      subject,
      body_content: textBody,
      variables: JSON.stringify(variables),
      status: "sent",
    });

    return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Email delivery failed";
    console.error("send-status-email error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
