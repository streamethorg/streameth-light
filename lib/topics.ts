import "server-only";
import { lazy } from "./lazy";
import { getStore } from "./data";
import type { Session } from "./types";

export interface Topic {
  name: string;
  slug: string;
  sessionIds: string[];
}

export function slugifyTopic(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "topic"
  );
}

const getTopicIndex = lazy(() => {
  const { sessions } = getStore();
  const bySlug = new Map<string, Topic>();

  for (const session of sessions) {
    for (const label of session.autoLabels ?? []) {
      const name = label.trim();
      if (!name) continue;
      const slug = slugifyTopic(name);
      let topic = bySlug.get(slug);
      if (!topic) {
        topic = { name, slug, sessionIds: [] };
        bySlug.set(slug, topic);
      }
      topic.sessionIds.push(session._id);
    }
  }

  return {
    all: [...bySlug.values()].sort(
      (a, b) => b.sessionIds.length - a.sessionIds.length
    ),
    bySlug,
  };
});

export function listTopics(): Topic[] {
  return getTopicIndex().all;
}

export function getTopicBySlug(slug: string): Topic | undefined {
  return getTopicIndex().bySlug.get(slug);
}

export function getTopicSessions(topic: Topic): Session[] {
  const { sessionById } = getStore();
  return topic.sessionIds
    .map((id) => sessionById.get(id))
    .filter((s): s is Session => Boolean(s));
}
