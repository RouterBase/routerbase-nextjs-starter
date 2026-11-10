import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, streamText } from "ai";

export const maxDuration = 30;

function describeError(error: unknown) {
  if (APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 401:
      case 403:
        return "RouterBase rejected the key. Check that it is active and has access to the model.";
      case 402:
        return "This key has insufficient credits.";
      case 400:
      case 404:
        return "Check the model ID and make sure it supports chat completions.";
      case 429:
        return "RouterBase rate limited the request. Try again shortly.";
    }
  }
  return "The model did not complete the request. Please try again.";
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const apiKey = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!/^sk-rb-[A-Za-z0-9_-]{8,192}$/.test(apiKey)) {
    return Response.json({ error: "Enter a valid RouterBase API key." }, { status: 401 });
  }

  const input: unknown = await request.json().catch(() => null);
  if (!input || typeof input !== "object" || !("model" in input) || !("prompt" in input)) {
    return Response.json({ error: "Enter a model ID and a prompt." }, { status: 400 });
  }

  const model = typeof input.model === "string" ? input.model.trim() : "";
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,119}$/.test(model) || !prompt || prompt.length > 4000) {
    return Response.json({ error: "Use a valid model ID and a prompt of 1–4,000 characters." }, { status: 400 });
  }

  const routerbase = createOpenAICompatible({
    name: "routerbase",
    baseURL: "https://routerbase.com/v1",
    apiKey,
  });
  const cancellation = new AbortController();
  const signal = AbortSignal.any([request.signal, cancellation.signal, AbortSignal.timeout(25_000)]);
  const result = streamText({
    model: routerbase.chatModel(model),
    prompt,
    maxOutputTokens: 500,
    maxRetries: 0,
    abortSignal: signal,
    onError() {},
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: { text?: string; error?: string; done?: boolean }) => {
        if (!cancellation.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") write({ text: part.text });
          if (part.type === "error") {
            write({ error: describeError(part.error) });
            return;
          }
          if (part.type === "abort") {
            write({ error: "The request was stopped or timed out." });
            return;
          }
        }
        write({ done: true });
      } catch (error) {
        if (!request.signal.aborted) write({ error: describeError(error) });
      } finally {
        if (!cancellation.signal.aborted) controller.close();
      }
    },
    cancel() {
      cancellation.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  });
}
