import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export type SendEmailInput = {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getSmtpConfig() {
  const host = requireEnv("SMTP_HOST");
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");
  const fromEmail = requireEnv("SMTP_FROM_EMAIL");
  const fromName = process.env.SMTP_FROM_NAME?.replace(/^["']|["']$/g, "").trim() || fromEmail;
  const useIpv4 = process.env.SMTP_USE_IPV4 === "true";

  return { host, port, user, pass, fromEmail, fromName, useIpv4 };
}

let transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;

function getTransporter() {
  if (!transporter) {
    const { host, port, user, pass, useIpv4 } = getSmtpConfig();
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      ...(useIpv4 ? { family: 4 } : {}),
    } as SMTPTransport.Options);
  }
  return transporter;
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      process.env.SMTP_FROM_EMAIL?.trim(),
  );
}

export async function sendEmail(input: SendEmailInput) {
  const { fromEmail, fromName } = getSmtpConfig();
  const transport = getTransporter();

  const info = await transport.sendMail({
    from: { name: fromName, address: fromEmail },
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  return { messageId: info.messageId };
}
