"use client";

import { useRef, useState, type FormEvent } from "react";

const examples = [
  {
    title: "Explain a concept",
    prompt: "Explain exponential backoff to a junior developer in three short steps.",
    response: "1. Wait briefly after the first failed request, then try again.\n\n2. Increase the wait after each failure: for example, 1 second, 2 seconds, then 4 seconds. Add a little randomness so clients don't all retry together.\n\n3. Cap the delay and stop after a few attempts. Retry transient failures, such as a temporary service outage, and return permanent errors to the caller.",
  },
  {
    title: "Draft a release note",
    prompt: "Draft a short release note for a dashboard that now supports CSV exports.",
    response: "You can now export dashboard results as a CSV. Open any dashboard, apply your filters, and select Export CSV to download the rows in your current view. Use the file in a spreadsheet or share a snapshot with your team.",
  },
  {
    title: "Review a design",
    prompt: "Give three review questions for an API that calls multiple language models.",
    response: "1. Which errors should trigger a retry or a provider switch, and which should return immediately?\n\n2. Do the fallback models support the same context length, tools, and response format?\n\n3. Can we trace which model served each request and see how fallback affected latency and cost?",
  },
];

type Mode = "replay" | "live";

export default function Home() {
  const [mode, setMode] = useState<Mode>("replay");
  const [example, setExample] = useState(0);
  const [prompt, setPrompt] = useState(examples[0].prompt);
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Ready");
  const [running, setRunning] = useState(false);
  const active = useRef<AbortController | null>(null);

  function selectMode(next: Mode) {
    setMode(next);
    setOutput("");
    setError("");
    setStatus("Ready");
    if (next === "replay") setKey("");
  }

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setRunning(true);
    setError("");
    setOutput("");
    setStatus("Streaming");

    try {
      if (mode === "replay") {
        const chunks = examples[example].response.match(/\S+\s*/g) ?? [];
        for (const chunk of chunks) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          controller.signal.throwIfAborted();
          setOutput((previous) => previous + chunk);
        }
      } else {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key.trim()}` },
          body: JSON.stringify({ prompt, model }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const failure = await response.json().catch(() => null);
          throw new Error(failure?.error ?? "The request failed. Please try again.");
        }
        if (!response.body) throw new Error("No response stream was available.");
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        let complete = false;
        let receivedText = false;
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const part = JSON.parse(line) as { text?: string; error?: string; done?: boolean };
              if (part.error) throw new Error(part.error);
              if (part.done) complete = true;
              if (part.text) {
                const text = part.text;
                receivedText = true;
                setOutput((previous) => previous + text);
              }
            }
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        if (!complete) throw new Error("The response ended early. Try again.");
        if (!receivedText) throw new Error("The model returned no visible text. Try a different model or prompt.");
      }
      setStatus("Complete");
    } catch (failure) {
      if (controller.signal.aborted) {
        setStatus("Stopped");
      } else {
        setError(failure instanceof Error ? failure.message : "Something went wrong.");
        setStatus("Error");
      }
    } finally {
      active.current = null;
      setRunning(false);
    }
  }

  return (
    <div className="site">
      <header className="site-header">
        <a className="brand" href="https://routerbase.com" aria-label="RouterBase home">
          <span className="brand-mark" aria-hidden="true">R</span>
          RouterBase <span className="divider" /> <span className="brand-sub">Starter</span>
        </a>
        <a className="header-link" href="https://github.com/RouterBase/routerbase-nextjs-starter">
          Source code <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main className="shell">
        <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow"><span /> NEXT.JS + AI SDK</p>
          <h1 id="page-title">Stream an AI response.</h1>
          <p className="intro">Try a recorded example or send your own prompt through RouterBase. Use the source to add streaming to your next app.</p>
        </section>

        <div className="workbench">
          <form className="panel" onSubmit={run}>
            <div className="panel-heading"><h2>Request</h2><span className="step">01</span></div>
            <div className="modes" role="group" aria-label="Request mode">
              <button type="button" aria-pressed={mode === "replay"} disabled={running} onClick={() => selectMode("replay")}>Example replay</button>
              <button type="button" aria-pressed={mode === "live"} disabled={running} onClick={() => selectMode("live")}>Live API</button>
            </div>
            {mode === "live" && (
              <div className="live-fields">
                <label htmlFor="api-key">RouterBase API key</label>
                <input id="api-key" type="password" autoComplete="off" spellCheck={false} value={key} maxLength={200} onChange={(event) => setKey(event.target.value)} required placeholder="sk-rb-…" aria-describedby="key-help" />
                <p id="key-help" className="hint">Your key passes through this demo’s server to RouterBase for the request. This app does not save it. <a href="https://routerbase.com/">Get a key ↗</a></p>
                <label htmlFor="model">Model ID</label>
                <input id="model" autoComplete="off" spellCheck={false} value={model} maxLength={120} onChange={(event) => setModel(event.target.value)} required placeholder="Paste a chat model ID" aria-describedby="model-help" />
                <p id="model-help" className="hint">Copy a chat model ID from the <a href="https://routerbase.com/models">RouterBase catalog ↗</a>.</p>
              </div>
            )}
            <label htmlFor="prompt">Prompt</label>
            <textarea id="prompt" value={prompt} readOnly={mode === "replay"} onChange={(event) => setPrompt(event.target.value)} maxLength={4000} required rows={4} />
            <div className="examples" aria-label="Example prompts">
              {examples.map((item, index) => (
                <button key={item.title} type="button" disabled={running} aria-pressed={mode === "replay" ? example === index : undefined} onClick={() => {
                  setExample(index);
                  setPrompt(item.prompt);
                  setOutput("");
                  setError("");
                  setStatus("Ready");
                }}>{item.title}</button>
              ))}
            </div>
            <div className="actions">
              <button type="submit" className="primary" disabled={running}>
                {mode === "replay" ? "Replay response" : "Send prompt"} <span aria-hidden="true">→</span>
              </button>
              {running && <button className="stop" type="button" onClick={() => active.current?.abort()}>Stop</button>}
            </div>
          </form>

          <section className="panel response" aria-labelledby="response-title">
            <div className="panel-heading"><h2 id="response-title">Response</h2><span className="step">02</span></div>
            <div className="status-row">
              <span className="status" data-state={status} role="status"><span />{status}</span>
              <span>{mode === "replay" ? "RECORDED EXAMPLE" : "ROUTERBASE API"}</span>
            </div>
            <div className="output" aria-busy={running}>
              {output || <p className="placeholder">The response will appear here as it streams.</p>}
            </div>
            {error && <p className="error" role="alert">{error}</p>}
          </section>
        </div>

        <footer className="footer">
          <p>Built with Next.js App Router and the Vercel AI SDK.</p>
          <a href="https://docs.routerbase.com/">RouterBase docs <span aria-hidden="true">↗</span></a>
        </footer>
      </main>
    </div>
  );
}
