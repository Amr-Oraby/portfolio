import { NextResponse } from "next/server";
import { Resend } from "resend";

// In-memory IP rate limiter: max 5 requests per 10 minutes per IP
// In a distributed serverless production deployment across multiple regions,
// this can be augmented with a distributed store like Upstash Redis.
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.expiresAt) {
    rateLimitMap.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  return true;
}

// Sanitize user inputs against HTML injection in email client
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Strip CRLF linebreaks to completely prevent email header injection
function sanitizeHeader(str: string): string {
  return str.replace(/[\r\n]/g, "").trim();
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed. Only POST requests are supported." },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export async function POST(req: Request) {
  try {
    // 1. Content-Type & Content-Length check (limit request payload size to max 10KB)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024) {
      return NextResponse.json(
        { success: false, error: "Payload too large. Maximum size is 10KB." },
        { status: 413 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { success: false, error: "Invalid Content-Type. Expected application/json." },
        { status: 400 }
      );
    }

    // 2. Client IP extraction for rate limiting
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please wait a few minutes before trying again." },
        { status: 429 }
      );
    }

    // 3. Body Parsing & Malformed JSON Protection
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Malformed JSON payload." },
        { status: 400 }
      );
    }

    const { name, email, message, _hp } = body || {};

    // 4. Honeypot check (invisible bot trap field)
    if (_hp) {
      // Silently return success to fool automated spambots without sending email
      return NextResponse.json({
        success: true,
        message: "Thank you! Your message has been sent successfully.",
      });
    }

    // 5. Server-side Validation
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, error: "Name is required." },
        { status: 400 }
      );
    }

    const cleanName = sanitizeHeader(name);
    if (cleanName.length < 2 || cleanName.length > 100) {
      return NextResponse.json(
        { success: false, error: "Name must be between 2 and 100 characters." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Email is required." },
        { status: 400 }
      );
    }

    const cleanEmail = sanitizeHeader(email);
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail) || cleanEmail.length > 150) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required." },
        { status: 400 }
      );
    }

    const cleanMessage = message.trim();
    if (cleanMessage.length < 1) {
      return NextResponse.json(
        { success: false, error: "Message cannot be empty." },
        { status: 400 }
      );
    }

    // Strict 500-character enforcement
    if (cleanMessage.length > 500) {
      return NextResponse.json(
        { success: false, error: "Message cannot exceed 500 characters." },
        { status: 400 }
      );
    }

    // 6. Check Resend API Key Configuration
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey || apiKey === "REPLACE_WITH_YOUR_REAL_RESEND_API_KEY") {
      return NextResponse.json(
        {
          success: false,
          error: "Resend API key is not configured. Please add your real RESEND_API_KEY in .env.local to deliver emails.",
        },
        { status: 503 }
      );
    }

    const recipient = process.env.CONTACT_EMAIL || "amrorapy50@gmail.com";
    const sender = process.env.RESEND_FROM_EMAIL || "Portfolio Contact <onboarding@resend.dev>";

    const resend = new Resend(apiKey);

    const escapedName = escapeHtml(cleanName);
    const escapedEmail = escapeHtml(cleanEmail);
    const escapedMessage = escapeHtml(cleanMessage).replace(/\n/g, "<br/>");

    const emailResponse = await resend.emails.send({
      from: sender,
      to: recipient,
      replyTo: cleanEmail,
      subject: `New Portfolio Message from ${cleanName}`,
      text: `Name: ${cleanName}\nEmail: ${cleanEmail}\n\nMessage:\n${cleanMessage}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
          <h2 style="color: #111827; margin-top: 0; font-size: 20px; font-weight: 600; border-bottom: 1px solid #f3f4f6; padding-bottom: 12px;">New Contact Message</h2>
          <div style="margin: 16px 0;">
            <p style="margin: 6px 0; color: #4b5563; font-size: 14px;"><strong>From:</strong> ${escapedName} (&lt;${escapedEmail}&gt;)</p>
            <p style="margin: 6px 0; color: #4b5563; font-size: 14px;"><strong>Reply-To:</strong> <a href="mailto:${escapedEmail}" style="color: #2563eb;">${escapedEmail}</a></p>
          </div>
          <div style="margin-top: 20px; padding: 16px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #f3f4f6;">
            <p style="color: #111827; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${escapedMessage}</p>
          </div>
          <p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center;">Sent from Amr Oraby Portfolio Contact Form</p>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error("[Resend Error]:", emailResponse.error.message || emailResponse.error);
      return NextResponse.json(
        {
          success: false,
          error: emailResponse.error.message || "Failed to deliver email. Please try again later or reach out directly.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Thank you! Your message has been sent successfully.",
    });
  } catch {
    console.error("[Contact API Error]: An unexpected error occurred");
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
