import { NextResponse } from "next/server";
import { runLintAgent } from "@/lib/agents";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const result = await runLintAgent();
    return NextResponse.json({ result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lint failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
