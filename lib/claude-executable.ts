import fs from "node:fs";
import path from "node:path";

export function getClaudeExecutablePath(): string | undefined {
  const configuredPath = process.env.CLAUDE_CODE_EXECUTABLE;
  if (configuredPath) return configuredPath;

  const platformPackages =
    process.platform === "linux"
      ? [
          `@anthropic-ai/claude-agent-sdk-linux-${process.arch}`,
          `@anthropic-ai/claude-agent-sdk-linux-${process.arch}-musl`,
        ]
      : [`@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`];

  for (const packageName of platformPackages) {
    const executablePath = path.join(
      process.cwd(),
      "node_modules",
      packageName,
      process.platform === "win32" ? "claude.exe" : "claude"
    );

    if (fs.existsSync(executablePath)) return executablePath;
  }

  return undefined;
}
