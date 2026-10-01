import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";
import { supabaseAuthIssuer } from "@/lib/supabase/mcpAuth";

// RFC 9728 metadata for /api/mcp: tells MCP clients that Supabase Auth is
// the authorization server to get an access token from.
const handler = (req: Request) =>
  protectedResourceHandler({ authServerUrls: [supabaseAuthIssuer()] })(req);

const optionsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, optionsHandler as OPTIONS };
