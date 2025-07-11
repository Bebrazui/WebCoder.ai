import { Ide } from "@/components/ide";

export default function Home() {
  return (
    <main className="overflow-hidden h-screen">
      <h1 className="sr-only">WebCoder.ai - A web-based IDE with AI-powered code transformation</h1>
      <Ide />
    </main>
  );
}
