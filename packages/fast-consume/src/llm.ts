// LLM access, through either provider:
//   - openrouter: OPENROUTER_API_KEY (the key the site's Ask and embeddings
//     already use, so the repo's .env.local serves both)
//   - anthropic: ANTHROPIC_API_KEY, or an `ant auth login` profile in
//     ANTHROPIC_CONFIG_DIR; ANTHROPIC_WORKSPACE_ID for a user-level key
// AGENT_PROVIDER forces one; otherwise OpenRouter when its key is set.
// FAST_CONSUME_MODEL picks the model; it defaults to Sonnet. This is two
// calls per talk, and on a real 20-minute talk Haiku's pick missed the whole
// second half of the talk where Sonnet's covered it start to end.
import Anthropic from "@anthropic-ai/sdk";
import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID || "";
const PROVIDER: "anthropic" | "openrouter" =
  process.env.AGENT_PROVIDER === "anthropic" || process.env.AGENT_PROVIDER === "openrouter"
    ? process.env.AGENT_PROVIDER
    : OPENROUTER_KEY
      ? "openrouter"
      : "anthropic";
export const MODEL =
  process.env.FAST_CONSUME_MODEL || (PROVIDER === "openrouter" ? "anthropic/claude-sonnet-5.5" : "claude-sonnet-5-5");

function anthropicCredentialsPresent(): boolean {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return true;
  const dir = process.env.ANTHROPIC_CONFIG_DIR || join(homedir(), ".config", "anthropic");
  try {
    return readdirSync(join(dir, "credentials")).some((f) => f.endsWith(".json"));
  } catch {
    return false;
  }
}

export function llmConfigured(): boolean {
  return PROVIDER === "openrouter" ? OPENROUTER_KEY !== "" : anthropicCredentialsPresent();
}

export function llmSetupHint(): string {
  return PROVIDER === "openrouter"
    ? "set OPENROUTER_API_KEY in .env.local"
    : "set OPENROUTER_API_KEY or ANTHROPIC_API_KEY in .env.local, or sign in with `ant auth login`";
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client =
      PROVIDER === "openrouter"
        ? new Anthropic({
            baseURL: "https://openrouter.ai/api",
            authToken: OPENROUTER_KEY,
            apiKey: null,
            maxRetries: 2,
            timeout: 120_000,
          })
        : new Anthropic({
            maxRetries: 2,
            timeout: 120_000,
            defaultHeaders: WORKSPACE_ID ? { "anthropic-workspace-id": WORKSPACE_ID } : undefined,
          });
  }
  return client;
}

// One tool call; returns the tool's raw input for the caller to validate.
// Raw because a model can and does return malformed input, and the caller
// has the context to decide what's salvageable. tool_choice stays "auto":
// Sonnet 5.5 rejects a forced tool ("tool_choice: type \"tool\" and \"any\"
// are not supported for this model"), so the system prompt asks for the call.
export async function callTool(system: string, prompt: string, tool: Anthropic.Tool, maxTokens: number): Promise<unknown> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: `${system}\n\nAnswer only by calling the ${tool.name} tool.`,
    tools: [tool],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("the model declined this request");
  if (response.stop_reason === "max_tokens") throw new Error("the reply was cut off (max_tokens)");
  const call = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!call) throw new Error("the model didn't call the tool");
  return call.input;
}
