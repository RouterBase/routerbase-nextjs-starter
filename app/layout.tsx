import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "RouterBase Chat Starter",
  description: "A Next.js starter for streaming model responses with RouterBase and the AI SDK.",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
