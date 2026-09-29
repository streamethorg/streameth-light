// Runs INSIDE a throwaway container on the VPS, attached to the streameth-platform
// Docker network. Invoked by export-db.sh — not meant to be run directly from a laptop.
import { MongoClient, ObjectId } from "mongodb";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DB_HOST = "mongodb";
const DB_USER = "root";
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = "streameth-prod";

if (!DB_PASSWORD) {
  console.error("Missing DB_PASSWORD env var");
  process.exit(1);
}

const uri = `mongodb://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:27017/${DB_NAME}?authSource=admin`;

function serialize(doc) {
  const out = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value instanceof ObjectId) out[key] = value.toString();
    else if (value instanceof Date) out[key] = value.toISOString();
    else if (Array.isArray(value))
      out[key] = value.map((v) =>
        v instanceof ObjectId
          ? v.toString()
          : v && typeof v === "object" && !(v instanceof Date)
            ? serialize(v)
            : v
      );
    else if (value && typeof value === "object") out[key] = serialize(value);
    else out[key] = value;
  }
  return out;
}

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(DB_NAME);
  console.log(`Connected to ${DB_NAME}`);

  const sessionsRaw = await db
    .collection("sessions")
    .find({ published: { $in: ["public", "private"] } })
    .toArray();

  // Transcripts are kept in their own file (transcripts.json, keyed by
  // session _id) rather than inline on each session — inline, they made
  // sessions.json a single ~58MB blob. A legacy bug also sometimes put the
  // raw WEBVTT transcript body in `subtitleUrl` instead of a real URL;
  // recover that as transcript text rather than losing it. See the matching
  // loaders in lib/data.ts and scripts/build-db.mjs.
  function looksLikeUrl(v) {
    return typeof v === "string" && v.length < 500 && /^https?:\/\//i.test(v);
  }
  const transcripts = {};

  const sessions = sessionsRaw.map((s) => {
    const clean = serialize(s);
    delete clean.videoTranscription;
    delete clean.aiAnalysis;

    const t = clean.transcripts;
    delete clean.transcripts;
    if (t) {
      let text = typeof t.text === "string" && t.text.trim() ? t.text : undefined;
      const subtitleUrl = looksLikeUrl(t.subtitleUrl) ? t.subtitleUrl : undefined;
      if (!subtitleUrl && typeof t.subtitleUrl === "string" && t.subtitleUrl.trim() && !text) {
        text = t.subtitleUrl;
      }
      if (text || subtitleUrl) {
        transcripts[clean._id] = { ...(text ? { text } : {}), ...(subtitleUrl ? { subtitleUrl } : {}) };
      }
    }

    return clean;
  });
  console.log(`sessions: ${sessions.length}`);
  console.log(`transcripts: ${Object.keys(transcripts).length}`);

  const eventIds = [...new Set(sessions.map((s) => s.eventId).filter(Boolean))].map(
    (id) => new ObjectId(id)
  );
  const stageIds = [...new Set(sessions.map((s) => s.stageId).filter(Boolean))].map(
    (id) => new ObjectId(id)
  );

  const events = (
    await db.collection("events").find({ _id: { $in: eventIds } }).toArray()
  ).map(serialize);
  console.log(`events: ${events.length}`);

  // Org IDs come from two sources: via each session's event (the normal
  // path), AND directly from session.organizationId. The second is required
  // because many public sessions reference an eventId that no longer exists
  // as a document (orphaned/dangling reference) — without it, every org
  // whose only sessions are orphaned this way would be silently dropped,
  // even though the sessions themselves are real, public, and playable.
  const orgIdsFromEvents = events.map((e) => e.organizationId).filter(Boolean);
  const orgIdsFromSessions = sessions.map((s) => s.organizationId).filter(Boolean);
  const orgIds = [...new Set([...orgIdsFromEvents, ...orgIdsFromSessions])].map(
    (id) => new ObjectId(id)
  );

  const stages = (
    await db.collection("stages").find({ _id: { $in: stageIds } }).toArray()
  ).map(serialize);
  console.log(`stages: ${stages.length}`);

  const organizations = (
    await db.collection("organizations").find({ _id: { $in: orgIds } }).toArray()
  ).map((o) => {
    const c = serialize(o);
    // drop billing/secrets, keep only display fields
    return {
      _id: c._id,
      name: c.name,
      logo: c.logo,
      banner: c.banner,
      slug: c.slug,
      accentColor: c.accentColor,
      location: c.location,
      description: c.description,
      url: c.url,
    };
  });
  console.log(`organizations: ${organizations.length}`);

  const eventIdStrings = events.map((e) => e._id);
  const speakers = (
    await db
      .collection("speakers")
      .find({ eventId: { $in: eventIdStrings } })
      .toArray()
  ).map(serialize);
  console.log(`speakers: ${speakers.length}`);

  const dataDir = "/app/data";
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, "sessions.json"), JSON.stringify(sessions, null, 2));
  writeFileSync(join(dataDir, "transcripts.json"), JSON.stringify(transcripts, null, 2));
  writeFileSync(join(dataDir, "events.json"), JSON.stringify(events, null, 2));
  writeFileSync(join(dataDir, "stages.json"), JSON.stringify(stages, null, 2));
  writeFileSync(
    join(dataDir, "organizations.json"),
    JSON.stringify(organizations, null, 2)
  );
  writeFileSync(join(dataDir, "speakers.json"), JSON.stringify(speakers, null, 2));

  await client.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
