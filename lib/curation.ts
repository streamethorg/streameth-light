import type { Session } from "./types";

// Curated by hand while auditing data/organizations.json + data/sessions.json
// (2026-09) — orgs that are test/dev tenants, personal test accounts, or
// content unrelated to the Ethereum ecosystem (a music/art collective's
// Instagram clips, a podcast, a portfolio reel, etc). Their sessions are
// almost entirely junk-titled ("video+…" placeholders, raw filenames, "test")
// even where a stray session slips past isJunkSession below, so the whole
// org is excluded rather than relying on per-session heuristics alone.
//
// Kept in sync by hand with the identical list in scripts/build-db.mjs
// (that script runs via plain `node`, not the TS toolchain, so it can't
// import this file — see cleanImageUrl there for the same constraint).
export const HIDDEN_ORG_SLUGS = new Set([
  "test",
  "pablo",
  "pablo_one",
  "pablo_test",
  "pablos_org",
  "pblvrt",
  "demo_org",
  "testy",
  "manad",
  "tanda_takon",
  "farmer",
  "supportvideos",
  "streameth_support_videos",
  "streameth",
  "letsgethai",
  "omotayo_wardaddy",
  "the_sound_of_the_crown",
  "grafica_directa_sl",
  "virtual_wingme",
  "virtual_wingmen",
  "hfdxgj",
  "pebels",
  "sebas",
  "john_pham",
  "ace_mansion",
  "scope_productions",
  "lost_laing",
  "nottv",
  "peregrinev2",
]);

function isJunkDescription(raw: string | undefined): boolean {
  const d = (raw ?? "").trim().toLowerCase();
  if (!d) return true;
  if (["no description", "clip", "test", "few"].includes(d)) return true;
  if (/^video\+[a-z0-9]+$/i.test(d)) return true;
  return false;
}

const JUNK_WORDS = [
  "test",
  "testing",
  "demo",
  "sample",
  "untitled",
  "no name",
  "no title",
  "testung",
  "testy",
  "testcaps",
];
const SUFFIX_WORDS = "clip|demo|live|recording|prod|caps|bypass|export";
const JUNK_WHOLE_TITLE_RE = new RegExp(
  `^(${JUNK_WORDS.join("|")})([ _.-]+(${SUFFIX_WORDS}))?([ _.-]*\\d+)?$`,
  "i"
);

// Flags sessions that are unedited platform test artifacts or raw,
// unpackaged stage dumps rather than real archived talks: Livepeer asset-id
// placeholder titles ("video+…"), raw uploaded filenames, bare "test"/"demo"
// titles, and "<Stage Name>-Recording N" dumps that were never given a real
// title or description. Deliberately conservative — a "test"-prefixed or
// "-Recording N" title only counts as junk when its description is *also*
// a placeholder, so real talks like "Testing large scale networks with
// Testground" (which has a real abstract) are kept.
export function isJunkSession(s: Pick<Session, "name" | "description">): boolean {
  const t = (s.name ?? "").trim();
  if (!t) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^video\+[a-z0-9]+$/i.test(t)) return true;
  if (/\.(mp4|mov|mkv|m4v)$/i.test(t)) return true;
  if (/^\d{3,5}(\s*\(\d+\))*\.[a-z0-9]+$/i.test(t)) return true;
  const bare = t.replace(/[\s_.-]+/g, " ").trim();
  if (JUNK_WHOLE_TITLE_RE.test(bare)) return true;
  if (/^test/i.test(t) && !t.includes(":") && t.split(/\s+/).length <= 6) {
    if (isJunkDescription(s.description)) return true;
  }
  if (/-Recording \d+$/i.test(t) && isJunkDescription(s.description)) return true;
  return false;
}
