import "server-only";
import { lazy } from "./lazy";
import { getStore } from "./data";
import type { Session, SessionSpeaker } from "./types";

export interface Speaker {
  name: string;
  slug: string;
  bio?: string;
  company?: string;
  twitter?: string;
  photo?: string;
  sessionIds: string[];
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "speaker"
  );
}

// Bios the CMS fills in when a speaker has none ("No description" on 445
// speakers); they read as junk in search snippets and on the page.
const PLACEHOLDER_BIOS = new Set(["no description", "-", "tbd", "tba", "n/a", "na", "none", "."]);

function realBio(bio: string | undefined): string | undefined {
  const clean = bio?.trim();
  return clean && !PLACEHOLDER_BIOS.has(clean.toLowerCase()) ? clean : undefined;
}

const getSpeakerIndex = lazy(() => {
  const { sessions } = getStore();
  const byName = new Map<string, Speaker>();

  for (const session of sessions) {
    for (const sp of session.speakers ?? []) {
      const name = sp.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      let speaker = byName.get(key);
      if (!speaker) {
        speaker = {
          name,
          slug: "",
          bio: realBio(sp.bio),
          company: sp.company || undefined,
          twitter: sp.twitter || undefined,
          photo: sp.photo || undefined,
          sessionIds: [],
        };
        byName.set(key, speaker);
      } else {
        speaker.bio = speaker.bio || realBio(sp.bio);
        speaker.company = speaker.company || sp.company || undefined;
        speaker.twitter = speaker.twitter || sp.twitter || undefined;
        speaker.photo = speaker.photo || sp.photo || undefined;
      }
      speaker.sessionIds.push(session._id);
    }
  }

  const usedSlugs = new Set<string>();
  for (const speaker of byName.values()) {
    const base = slugify(speaker.name);
    let slug = base;
    let n = 2;
    while (usedSlugs.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    speaker.slug = slug;
    usedSlugs.add(slug);
  }

  const bySlug = new Map<string, Speaker>();
  const slugByName = new Map<string, string>();
  for (const speaker of byName.values()) {
    bySlug.set(speaker.slug, speaker);
    slugByName.set(speaker.name.toLowerCase(), speaker.slug);
  }

  return {
    all: [...byName.values()].sort(
      (a, b) => b.sessionIds.length - a.sessionIds.length
    ),
    bySlug,
    slugByName,
  };
});

export function listSpeakers(): Speaker[] {
  return getSpeakerIndex().all;
}

export function getSpeakerBySlug(slug: string): Speaker | undefined {
  return getSpeakerIndex().bySlug.get(slug);
}

export function getSpeakerSessions(speaker: Speaker): Session[] {
  const { sessionById } = getStore();
  return speaker.sessionIds
    .map((id) => sessionById.get(id))
    .filter((s): s is Session => Boolean(s));
}

export function findSpeakerSlugForName(name: string): string | undefined {
  return getSpeakerIndex().slugByName.get(name.trim().toLowerCase());
}

export function speakerBadge(sp: SessionSpeaker): { name: string; slug: string | undefined } {
  return { name: sp.name, slug: findSpeakerSlugForName(sp.name) };
}
