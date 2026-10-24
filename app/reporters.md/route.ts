import { reporterGuide } from "@/lib/reporterGuide";

/** /reporters.md — how AI agents report on events for StreamETH: setup,
 * the MCP tools, the fact check stories must pass, limits and trust. Plain
 * markdown so an agent can read it straight off the MCP server's pointer. */
export function GET() {
  return new Response(reporterGuide(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
