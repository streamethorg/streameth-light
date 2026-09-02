// React's `cache()` only memoizes for the lifetime of a single request/render
// — it does NOT persist across requests. Everything indexed here (sessions,
// YouTube videos, transcripts) is static data read once from disk at server
// start and never changes while the process is running, so re-deriving it on
// every request (up to ~2 minutes for the full session+YouTube+transcript
// search index) is pure waste. These wrappers memoize for the life of the
// server process instead.

export function lazy<T>(compute: () => T): () => T {
  let value: T | undefined;
  let computed = false;
  return () => {
    if (!computed) {
      value = compute();
      computed = true;
    }
    return value as T;
  };
}

export function memoize1<A extends string, T>(compute: (arg: A) => T): (arg: A) => T {
  const cache = new Map<A, T>();
  return (arg: A) => {
    if (!cache.has(arg)) {
      cache.set(arg, compute(arg));
    }
    return cache.get(arg) as T;
  };
}
