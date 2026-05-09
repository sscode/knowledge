import { query } from "@anthropic-ai/claude-agent-sdk";
import { WIKI_DIR, withWriteLock, withWriteLockStream } from "./wiki";

type AgentOpts = {
  prompt: string;
  allowedTools: string[];
  maxTurns: number;
  maxBudgetUsd: number;
};

async function runAgent(opts: AgentOpts): Promise<string> {
  let result = "";
  for await (const message of query({
    prompt: opts.prompt,
    options: {
      cwd: WIKI_DIR,
      model: "claude-sonnet-4-6",
      allowedTools: opts.allowedTools,
      permissionMode: "dontAsk",
      maxTurns: opts.maxTurns,
      maxBudgetUsd: opts.maxBudgetUsd,
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
  return result;
}

async function* streamAgent(
  opts: AgentOpts
): AsyncGenerator<{ type: "progress"; text: string } | { type: "result"; text: string }> {
  let result = "";
  for await (const message of query({
    prompt: opts.prompt,
    options: {
      cwd: WIKI_DIR,
      model: "claude-sonnet-4-6",
      allowedTools: opts.allowedTools,
      permissionMode: "dontAsk",
      maxTurns: opts.maxTurns,
      maxBudgetUsd: opts.maxBudgetUsd,
    },
  })) {
    if (message.type === "tool_use_summary") {
      yield { type: "progress", text: message.summary };
    } else if (message.type === "tool_progress") {
      yield { type: "progress", text: `${message.tool_name}...` };
    } else if (
      message.type === "result" &&
      message.subtype === "success" &&
      message.result
    ) {
      result = message.result;
    }
  }
  yield { type: "result", text: result };
}

function ingestAgentOpts(sourcePath: string, description: string): AgentOpts {
  return {
    prompt: `You are the knowledge base ingest agent.

A new source has been added at: ${sourcePath}
Description: ${description}

Your task:
1. Read schema/AGENTS.md for conventions
2. Read the source file at ${sourcePath}
3. Read index.md to see existing pages
4. Extract entities, concepts, decisions, and facts from the source
5. For each: update an existing page in pages/ or create a new one
6. Update index.md with any new entries
7. Append a log entry to log.md with today's date, "ingest", and a summary of changes

Follow the conventions in schema/AGENTS.md. Use wikilinks [[page-name]] for cross-references.
Do not modify the source file. Do not modify schema files.`,
    allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
    maxTurns: 30,
    maxBudgetUsd: 0.5,
  };
}

export async function runIngestAgent(
  sourcePath: string,
  description: string
): Promise<string> {
  return withWriteLock(() => runAgent(ingestAgentOpts(sourcePath, description)));
}

export function streamIngestAgent(sourcePath: string, description: string) {
  return withWriteLockStream(() =>
    streamAgent(ingestAgentOpts(sourcePath, description))
  );
}

function queryAgentOpts(question: string): AgentOpts {
  return {
    prompt: `You are the knowledge base query agent.

A user asked: "${question}"

Your task:
1. Read index.md to find relevant pages
2. Use Grep to search pages/ for relevant content
3. Read the most relevant pages
4. Synthesize a clear, well-structured answer based on wiki content
5. Cite sources using [[page-name]] wikilinks
6. If the wiki lacks sufficient information, say so explicitly

Only answer based on what is in the wiki. Do not fabricate information.`,
    allowedTools: ["Read", "Glob", "Grep"],
    maxTurns: 15,
    maxBudgetUsd: 0.2,
  };
}

export async function runQueryAgent(question: string): Promise<string> {
  return runAgent(queryAgentOpts(question));
}

export function streamQueryAgent(question: string) {
  return streamAgent(queryAgentOpts(question));
}

export async function runLintAgent(): Promise<string> {
  return withWriteLock(() =>
    runAgent({
      prompt: `You are the knowledge base lint agent.

Audit and repair the wiki.

1. Read schema/AGENTS.md for conventions
2. Read index.md
3. Read all files in pages/
4. Check for:
   - Contradictions between pages (same fact stated differently)
   - Orphan pages (no incoming wikilinks from other pages)
   - Broken wikilinks (references to pages that don't exist)
   - Stale content (old dates with no recent updates)
   - index.md entries that don't match actual files
   - Missing index.md entries for existing pages
   - Pages missing required sections
5. Fix each issue by editing the relevant files
6. Append a lint report to log.md with date, "lint", issues found/fixed, and anything needing human review`,
      allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
      maxTurns: 40,
      maxBudgetUsd: 1.0,
    })
  );
}
