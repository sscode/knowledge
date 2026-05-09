import { query } from "@anthropic-ai/claude-agent-sdk";

export type KbIntent =
  | { action: "ask"; question: string }
  | { action: "ingest_text"; title?: string; text: string }
  | { action: "list_pages" }
  | { action: "read_page"; file: string }
  | { action: "read_source"; file: string }
  | { action: "save_page"; file: string; content: string }
  | { action: "delete_page"; file: string }
  | { action: "self_heal" }
  | { action: "deep_repair" }
  | { action: "help"; message: string };

function parseJsonResult(result: string): KbIntent {
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      action: "help",
      message: "I could not understand that request.",
    };
  }

  return JSON.parse(jsonMatch[0]) as KbIntent;
}

export async function routeKbIntent(request: string): Promise<KbIntent> {
  const prompt = `You route natural-language requests for a structured knowledge-base app.

Return ONLY one JSON object. No markdown. No commentary.

Allowed actions:
- {"action":"ask","question":"..."} for questions that should retrieve/synthesize wiki knowledge.
- {"action":"ingest_text","title":"optional title","text":"..."} for requests to add/save/remember provided information.
- {"action":"list_pages"} for listing wiki pages.
- {"action":"read_page","file":"pages/example.md"} for viewing a generated page.
- {"action":"read_source","file":"sources/example.md"} for viewing original source text.
- {"action":"save_page","file":"pages/example.md","content":"# Full markdown..."} for replacing a page with provided full Markdown.
- {"action":"delete_page","file":"pages/example.md"} for deleting a page.
- {"action":"self_heal"} for deterministic structural repair.
- {"action":"deep_repair"} for AI audit/repair of ambiguous wiki issues.
- {"action":"help","message":"..."} if the request is unclear or asks for unsupported behavior.

Rules:
- Prefer "ask" for questions.
- Prefer "ingest_text" when the user says remember, ingest, save, add to the KB, or provides facts/notes to store.
- Only use save_page or delete_page when the user clearly asks to edit/delete a specific page path.
- Only use read_source when the user asks for original source/source doc text.
- Use exact file paths only if the user provides them. If needed path is missing, return help.

User request: ${JSON.stringify(request)}`;

  let result = "";
  for await (const message of query({
    prompt,
    options: {
      model: "claude-sonnet-4-6",
      allowedTools: [],
      permissionMode: "dontAsk",
      maxTurns: 1,
      maxBudgetUsd: 0.05,
    },
  })) {
    if (
      message.type === "result" &&
      message.subtype === "success" &&
      message.result
    ) {
      result = message.result;
    }
  }

  return parseJsonResult(result);
}
