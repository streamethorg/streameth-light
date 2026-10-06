import { serializeJsonLd, type JsonLd as JsonLdData } from "@/lib/seo";

/** Structured data for search engines and AI crawlers, rendered in the page
 * body as Next.js recommends (see node_modules/next/dist/docs/01-app/02-guides/json-ld.md). */
export default function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
