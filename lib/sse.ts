type AgentEvent =
  | { type: "progress"; text: string }
  | { type: "result"; text: string };

export function agentStreamToSSE(
  events: AsyncGenerator<AgentEvent>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Agent failed";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", text: message })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
