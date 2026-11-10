# RouterBase Chat Starter

A Next.js App Router example that streams text from RouterBase with the Vercel AI SDK. Use the example replay without credentials, or choose **Live API** to run a chat model with your own RouterBase API key.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FRouterBase%2Frouterbase-nextjs-starter)

- [Live demo](https://routerbase-nextjs-starter.vercel.app)
- [RouterBase model catalog](https://routerbase.com/models)
- [RouterBase documentation](https://docs.routerbase.com/)

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open <http://localhost:3000>. **Example replay** streams a fixed sample locally. To make a real request, select **Live API**, enter a [RouterBase API key](https://routerbase.com/) and a chat model ID from the catalog, then send a prompt. Live requests use the credits associated with your key.

The browser keeps the key in memory and sends it to the app’s Next.js server on each live request. The server forwards it to RouterBase over HTTPS. The app does not save the key or log the request body. Run a local or self-hosted copy if you prefer to use a key on an instance you control. The live route caps requests at 500 output tokens and stops after 25 seconds.

## How it works

- `app/page.tsx` provides the request form and renders the streamed response.
- `app/api/chat/route.ts` uses `createOpenAICompatible` and `streamText` to call RouterBase. It returns newline-delimited JSON with text, completion, or error events.
- No database or deployment environment variables are required.

Run `npm run build` and `npm run typecheck` to verify changes.
