// Exit codes, so a wrapper script can tell "nothing to do yet" (no
// transcript) from "something is broken" (a download failing, the LLM failing).
export const EXIT = {
  usage: 1,
  sourceNotFound: 2,
  download: 3,
  transcript: 4,
  unsuitableSource: 5,
  llm: 6,
  render: 7,
} as const;

export class FastConsumeError extends Error {
  constructor(
    message: string,
    readonly exitCode: number
  ) {
    super(message);
  }
}
