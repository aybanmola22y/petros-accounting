import nodemailer from "nodemailer";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i === -1) continue;
  const key = line.slice(0, i);
  let val = line.slice(i + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT || 587),
  secure: false,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  family: env.SMTP_USE_IPV4 === "true" ? 4 : undefined,
});

const to = process.argv[2] || "test@example.com";

try {
  const info = await transport.sendMail({
    from: { name: env.SMTP_FROM_NAME || "Petrosphere Inc.", address: env.SMTP_FROM_EMAIL },
    to,
    subject: "PetroBook SMTP test",
    text: "SMTP credentials are working.",
  });
  console.log("OK", info.messageId);
} catch (err) {
  console.error("FAIL", err instanceof Error ? err.message : err);
  process.exit(1);
}
