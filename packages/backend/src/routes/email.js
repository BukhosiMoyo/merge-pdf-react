// packages/backend/src/routes/email.js
import express from "express";
import { Router } from "express";
import nodemailer from "nodemailer";
import crypto from "crypto";

export const emailRouter = Router();
const json = express.json({ limit: "1mb" });

emailRouter.post("/send", json, async (req, res) => {
  try {
    // --- simple IP cooldown (30s) ---
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString();
    if (!emailRouter._rate) emailRouter._rate = new Map();
    const last = emailRouter._rate.get(ip) || 0;
    if (Date.now() - last < 30_000) {
      return res.status(429).json({ error: { code: "too_many", message: "Please wait a few seconds and try again." } });
    }
    emailRouter._rate.set(ip, Date.now());

    const {
      from_name = "Merge PDF user",
      from_email,
      to_email,
      message = "",
      file_url,
      file_name = "merged.pdf",
      // OPTIONAL: marketing consent flags
      consent_news = false,
      consent_product = false
    } = req.body || {};

    if (!isEmail(from_email) || !isEmail(to_email) || typeof file_url !== "string" || !file_url) {
      return res.status(400).json({ error: { code: "invalid_request", message: "Missing or invalid fields." } });
    }

    const absoluteUrl = toAbsoluteUrl(req, file_url);
    const fileResp = await fetch(absoluteUrl);
    if (!fileResp.ok) {
      return res.status(404).json({ error: { code: "file_fetch_failed", message: "Unable to fetch merged PDF." } });
    }
    const pdfBuffer = Buffer.from(await fileResp.arrayBuffer());

    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: {
        user: process.env.SMTP_USER, // noreply@mergepdf.co.za
        pass: process.env.SMTP_PASS
      },
      tls: { rejectUnauthorized: process.env.SMTP_STRICT_TLS === "true" }
    });

    const site = process.env.SITE_NAME || "Merge PDF";
    const fromDisplay = `${site} <${process.env.MAIL_FROM || "noreply@mergepdf.co.za"}>`;
    const replyTo = `${from_name} <${from_email}>`;

    const html = renderHtmlEmail({ site, from_name, message, file_name, file_url: absoluteUrl });
    const text = renderTextEmail({ site, from_name, message, file_name, file_url: absoluteUrl });

    const info = await transport.sendMail({
      from: fromDisplay,
      to: to_email,
      replyTo,
      subject: `${site}: ${file_name}`,
      text,
      html,
      attachments: [{ filename: file_name, content: pdfBuffer, contentType: "application/pdf" }],
      headers: { "X-Entity-Ref-ID": crypto.randomUUID() }
    });

    // (Optional) store marketing consent for your list — append to /data/emails.json
    if (consent_news || consent_product) {
      queueContactSave({ from_name, from_email, consent_news, consent_product });
    }

    return res.json({ ok: true, id: info.messageId });
  } catch (e) {
    return res.status(500).json({ error: { code: "email_failed", message: e.message } });
  }
});

// helpers
function isEmail(x){ return typeof x==="string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x); }
function toAbsoluteUrl(req, url){
  if (/^https?:\/\//i.test(url)) return url;
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.get("host");
  return `${proto}://${host}${url.startsWith("/") ? url : "/" + url}`;
}
function escapeHtml(s){ return s.replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function renderHtmlEmail({ site, from_name, message, file_name, file_url }){
  const safe = escapeHtml(message || "");
  return `
  <div style="font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111">
    <p><strong>${site}</strong> sent you a PDF.</p>
    <p><strong>From:</strong> ${escapeHtml(from_name || "Merge PDF user")}</p>
    ${safe ? `<p style="white-space:pre-wrap"><strong>Note:</strong><br>${safe}</p>` : ""}
    <p><strong>File:</strong> ${escapeHtml(file_name)}</p>
    <p>Download link (if needed): <a href="${file_url}">${file_url}</a></p>
  </div>`;
}
function renderTextEmail({ site, from_name, message, file_name, file_url }){
  return [
    `${site} sent you a PDF.`,
    `From: ${from_name || "Merge PDF user"}`,
    message ? `\nNote:\n${message}` : "",
    `\nFile: ${file_name}`,
    `Download link: ${file_url}`
  ].join("\n");
}

// async fire-and-forget to save contacts if user consented
async function queueContactSave(payload){
  try {
    const { promises: fsp } = await import("fs");
    const { default: path } = await import("path");
    const { fileURLToPath } = await import("url");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const DATA_DIR = path.join(__dirname, "..", "..", "data");
    const LIST_PATH = path.join(DATA_DIR, "emails.json");
    await fsp.mkdir(DATA_DIR, { recursive: true });
    let list = [];
    try { list = JSON.parse(await fsp.readFile(LIST_PATH, "utf8")); } catch {}
    list.push({ ...payload, ts: Date.now() });
    await fsp.writeFile(LIST_PATH, JSON.stringify(list), "utf8");
  } catch {}
}
