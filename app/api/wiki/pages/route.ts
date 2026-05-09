import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deletePage, listManagedPages, readPage, writePage } from "@/lib/wiki-admin";
import { runWikiSelfHeal } from "@/lib/wiki-self-heal";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const url = new URL(req.url);
    const file = url.searchParams.get("file");
    if (file) {
      return NextResponse.json(await readPage(file));
    }

    return NextResponse.json({ pages: await listManagedPages() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load pages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const { file, content } = await req.json();
    if (typeof file !== "string" || typeof content !== "string") {
      return NextResponse.json({ error: "File and content required" }, { status: 400 });
    }

    await writePage(file, content);
    const selfHeal = await runWikiSelfHeal();
    return NextResponse.json({ ok: true, selfHeal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save page";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const url = new URL(req.url);
    const file = url.searchParams.get("file");
    if (!file) {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    await deletePage(file);
    const selfHeal = await runWikiSelfHeal();
    return NextResponse.json({ ok: true, selfHeal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete page";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
