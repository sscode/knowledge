import { NextResponse } from "next/server";

function tokenFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return req.headers.get("x-kb-admin-token");
}

export function requireAdmin(req: Request): NextResponse | null {
  const configuredToken = process.env.KB_ADMIN_TOKEN;
  if (!configuredToken) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "KB_ADMIN_TOKEN is not configured" },
        { status: 500 }
      );
    }
    return null;
  }

  if (tokenFromRequest(req) !== configuredToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function requireWebhookSecret(req: Request): NextResponse | null {
  const configuredSecret = process.env.AGENTMAIL_WEBHOOK_SECRET;
  if (!configuredSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "AGENTMAIL_WEBHOOK_SECRET is not configured" },
        { status: 500 }
      );
    }
    return null;
  }

  const url = new URL(req.url);
  const providedSecret =
    req.headers.get("x-agentmail-webhook-secret") ||
    req.headers.get("x-kb-webhook-secret") ||
    url.searchParams.get("secret");

  if (providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
