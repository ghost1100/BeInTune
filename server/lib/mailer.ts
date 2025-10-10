import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

let transporter: nodemailer.Transporter | null = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_PORT) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

if (process.env.SENDGRID_API_KEY) {
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  } catch (e) {
    // ignore
  }
}

function extractContentFromSendGridStyle(msg: any) {
  let text = msg.text || msg.plain || "";
  let html = msg.html || "";
  if ((!text || !html) && Array.isArray(msg.content)) {
    for (const c of msg.content) {
      if (c.type === "text/plain") text = text || c.value;
      if (c.type === "text/html") html = html || c.value;
    }
  }
  return { text, html };
}

function recipientsFromMsg(msg: any) {
  if (msg.to) return Array.isArray(msg.to) ? msg.to : [msg.to];
  if (Array.isArray(msg.personalizations)) {
    return msg.personalizations.flatMap((p: any) =>
      (p.to || []).map((t: any) => (typeof t === "string" ? t : t.email)),
    );
  }
  return [];
}

export async function sendMail(msg: any) {
  const from = msg.from || process.env.FROM_EMAIL || "no-reply@example.com";
  const toList = recipientsFromMsg(msg);
  const { text, html } = extractContentFromSendGridStyle(msg);

  // If SMTP configured, use nodemailer
  if (transporter) {
    const mailOptions: any = {
      from,
      to: toList.length === 1 ? toList[0] : toList,
      subject: msg.subject || "",
      text: text || undefined,
      html: html || undefined,
    };
    try {
      const res = await transporter.sendMail(mailOptions);
      return res;
    } catch (err) {
      console.error("SMTP send error:", err);
      // fall through to try SendGrid if available
    }
  }

  // Fallback to SendGrid if configured
  if (process.env.SENDGRID_API_KEY) {
    try {
      // If message already in SendGrid format, send as-is
      if (msg.personalizations || msg.content) {
        return await sgMail.send(msg as any);
      }
      // Otherwise, map to SendGrid format
      const sgMsg: any = {
        personalizations: (toList || []).map((email: string) => ({ to: [{ email }] })),
        from,
        subject: msg.subject || "",
        content: [
          { type: "text/plain", value: text || "" },
          { type: "text/html", value: html || "" },
        ],
      };
      return await sgMail.send(sgMsg as any);
    } catch (err) {
      console.error("SendGrid send error:", err);
      throw err;
    }
  }

  throw new Error("No mailer configured (missing SMTP and SendGrid config)");
}
