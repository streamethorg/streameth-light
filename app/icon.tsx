import { renderAppIcon } from "@/lib/appIcon";

export const contentType = "image/png";

// 192 and 512 are the two sizes browsers require of a manifest before they
// offer to install the app; app/manifest.ts points at both.
export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType },
    { id: "512", size: { width: 512, height: 512 }, contentType },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  return renderAppIcon(Number(await id));
}
