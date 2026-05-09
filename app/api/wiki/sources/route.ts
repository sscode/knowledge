import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readSource } from "@/lib/wiki-admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const url = new URL(req.url);
    const file = url.searchParams.get("file");
    if (!file) {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    return NextResponse.json({ file, content: await readSource(file) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load source";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
