// Media links reporters add to an event's feed (lib/embeds.ts): which
// provider a link belongs to, its canonical form, how to ask the provider
// about it (oEmbed), and the player URL we build for it ourselves — never the
// provider's embed HTML. Anything that isn't a known provider becomes a link
// card from the page's Open Graph tags. Pure, so it's unit-tested
// (lib/embedCore.test.mjs).

/**
 * @typedef {"youtube" | "x" | "vimeo" | "tiktok" | "spotify" | "soundcloud" | "link"} EmbedProvider
 *
 * @typedef {{
 *   provider: EmbedProvider,
 *   externalId: string | null,
 *   canonicalUrl: string,
 *   variant: string | null,
 * }} MediaMatch
 *
 * @typedef {{
 *   title: string,
 *   description: string,
 *   authorName: string | null,
 *   authorUrl: string | null,
 *   siteName: string | null,
 *   imageUrl: string | null,
 * }} MediaFields
 */

export const MAX_URL_LENGTH = 2000;
export const MAX_NOTE_LENGTH = 280;
const MAX_TITLE = 300;
const MAX_DESCRIPTION = 1000;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const X_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const DIGITS = /^\d{1,25}$/;
const SPOTIFY_TYPES = new Set(["episode", "track", "show", "playlist", "album"]);

/** @param {string} host */
function bareHost(host) {
  return host.toLowerCase().replace(/^(www|m|mobile)\./, "");
}

/** @param {URL} u @returns {MediaMatch | null} */
function matchYoutube(u) {
  const host = bareHost(u.hostname);
  const parts = u.pathname.split("/").filter(Boolean);
  let id = null;
  let short = false;
  if (host === "youtu.be") id = parts[0] ?? null;
  else if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") id = u.searchParams.get("v");
    else if (parts[0] === "shorts") {
      id = parts[1] ?? null;
      short = true;
    } else if (parts[0] === "live" || parts[0] === "embed" || parts[0] === "v") id = parts[1] ?? null;
  } else return null;
  if (!id || !YOUTUBE_ID.test(id)) return null;
  return {
    provider: "youtube",
    externalId: id,
    canonicalUrl: short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
    variant: short ? "short" : null,
  };
}

/** @param {URL} u @returns {MediaMatch | null} */
function matchX(u) {
  const host = bareHost(u.hostname);
  if (host !== "x.com" && host !== "twitter.com") return null;
  const parts = u.pathname.split("/").filter(Boolean);
  // /i/web/status/<id> has no handle.
  if (parts[0] === "i" && parts[1] === "web" && (parts[2] === "status" || parts[2] === "statuses") && DIGITS.test(parts[3] ?? "")) {
    return { provider: "x", externalId: parts[3], canonicalUrl: `https://x.com/i/web/status/${parts[3]}`, variant: null };
  }
  if (X_HANDLE.test(parts[0] ?? "") && (parts[1] === "status" || parts[1] === "statuses") && DIGITS.test(parts[2] ?? "")) {
    return { provider: "x", externalId: parts[2], canonicalUrl: `https://x.com/${parts[0]}/status/${parts[2]}`, variant: null };
  }
  return null;
}

/** @param {URL} u @returns {MediaMatch | null} */
function matchVimeo(u) {
  const host = bareHost(u.hostname);
  const parts = u.pathname.split("/").filter(Boolean);
  let id = null;
  let hash = null;
  if (host === "player.vimeo.com" && parts[0] === "video") {
    id = parts[1] ?? null;
    hash = u.searchParams.get("h");
  } else if (host === "vimeo.com") {
    // vimeo.com/<id>, vimeo.com/<id>/<hash> (unlisted), vimeo.com/channels/<name>/<id>
    const at = parts.findIndex((p) => DIGITS.test(p));
    if (at >= 0) {
      id = parts[at];
      const next = parts[at + 1];
      if (next && /^[0-9a-f]{6,20}$/.test(next)) hash = next;
    }
  } else return null;
  if (!id || !DIGITS.test(id)) return null;
  return {
    provider: "vimeo",
    externalId: hash ? `${id}/${hash}` : id,
    canonicalUrl: hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`,
    variant: null,
  };
}

/** @param {URL} u @returns {MediaMatch | null} */
function matchTiktok(u) {
  if (bareHost(u.hostname) !== "tiktok.com") return null;
  const parts = u.pathname.split("/").filter(Boolean);
  const user = parts[0];
  if (!user?.startsWith("@") || parts[1] !== "video" || !DIGITS.test(parts[2] ?? "")) return null;
  return {
    provider: "tiktok",
    externalId: parts[2],
    canonicalUrl: `https://www.tiktok.com/${user}/video/${parts[2]}`,
    variant: "short",
  };
}

/** @param {URL} u @returns {MediaMatch | null} */
function matchSpotify(u) {
  if (u.hostname.toLowerCase() !== "open.spotify.com") return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts[0]?.startsWith("intl-")) parts.shift();
  const [type, id] = parts;
  if (!type || !SPOTIFY_TYPES.has(type) || !id || !/^[A-Za-z0-9]{22}$/.test(id)) return null;
  return { provider: "spotify", externalId: `${type}/${id}`, canonicalUrl: `https://open.spotify.com/${type}/${id}`, variant: type };
}

/** @param {URL} u @returns {MediaMatch | null} */
function matchSoundcloud(u) {
  if (bareHost(u.hostname) !== "soundcloud.com") return null;
  const parts = u.pathname.split("/").filter(Boolean);
  // soundcloud.com/<user>/<track> or /<user>/sets/<playlist>; a bare
  // profile isn't a single item.
  if (parts.length < 2 || !/^[\w-]+$/.test(parts[0])) return null;
  const isSet = parts[1] === "sets";
  if (isSet && parts.length < 3) return null;
  const path = parts.slice(0, isSet ? 3 : 2).join("/");
  if (!/^[\w/-]+$/.test(path)) return null;
  return {
    provider: "soundcloud",
    externalId: path.toLowerCase(),
    canonicalUrl: `https://soundcloud.com/${path}`,
    variant: isSet ? "playlist" : "track",
  };
}

const MATCHERS = [matchYoutube, matchX, matchVimeo, matchTiktok, matchSpotify, matchSoundcloud];

/**
 * A pasted link → its provider and canonical URL. http:// is upgraded to
 * https://; other schemes, credentials in the URL, IP-literal hosts and
 * non-default ports are refused (null). Unknown sites are `link` cards.
 *
 * @param {string} raw
 * @returns {MediaMatch | null}
 */
export function matchMedia(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text || text.length > MAX_URL_LENGTH) return null;
  /** @type {URL} */
  let u;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (u.protocol === "http:") u.protocol = "https:";
  if (u.protocol !== "https:") return null;
  if (u.username || u.password || u.port) return null;
  if (!u.hostname.includes(".") || isIpLiteral(u.hostname)) return null;
  for (const match of MATCHERS) {
    const m = match(u);
    if (m) return m;
  }
  u.hash = "";
  return { provider: "link", externalId: null, canonicalUrl: u.toString(), variant: null };
}

/** @param {string} host */
function isIpLiteral(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
}

/**
 * The provider's public oEmbed endpoint for a match; null for link cards.
 *
 * @param {MediaMatch} m
 * @returns {string | null}
 */
export function oembedUrl(m) {
  const url = encodeURIComponent(m.canonicalUrl);
  switch (m.provider) {
    case "youtube":
      // Shorts URLs aren't always accepted; the watch URL always is.
      return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${m.externalId}`)}`;
    case "x":
      return `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${url}`;
    case "vimeo":
      return `https://vimeo.com/api/oembed.json?url=${url}`;
    case "tiktok":
      return `https://www.tiktok.com/oembed?url=${url}`;
    case "spotify":
      return `https://open.spotify.com/oembed?url=${url}`;
    case "soundcloud":
      return `https://soundcloud.com/oembed?format=json&url=${url}`;
    default:
      return null;
  }
}

/**
 * The iframe we build for an embed, from its id — so no provider HTML ever
 * reaches the page. X posts and link cards have none (X renders through
 * widgets.js on our own blockquote).
 *
 * @param {{ provider: string, externalId: string | null, url: string, variant: string | null }} e
 * @returns {{ src: string, aspect: "video" | "vertical" | "audio" | "audio-tall" } | null}
 */
export function playerFor(e) {
  const id = e.externalId ?? "";
  switch (e.provider) {
    case "youtube":
      return YOUTUBE_ID.test(id)
        ? { src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`, aspect: e.variant === "short" ? "vertical" : "video" }
        : null;
    case "vimeo": {
      const [vid, hash] = id.split("/");
      if (!DIGITS.test(vid ?? "")) return null;
      return { src: `https://player.vimeo.com/video/${vid}?dnt=1&autoplay=1${hash ? `&h=${hash}` : ""}`, aspect: "video" };
    }
    case "tiktok":
      return DIGITS.test(id) ? { src: `https://www.tiktok.com/embed/v2/${id}`, aspect: "vertical" } : null;
    case "spotify": {
      const [type, sid] = id.split("/");
      if (!SPOTIFY_TYPES.has(type ?? "") || !/^[A-Za-z0-9]{22}$/.test(sid ?? "")) return null;
      return {
        src: `https://open.spotify.com/embed/${type}/${sid}`,
        aspect: type === "episode" || type === "track" ? "audio" : "audio-tall",
      };
    }
    case "soundcloud":
      return /^[\w/-]+$/.test(id)
        ? {
            src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com/${id}`)}&auto_play=true&visual=false`,
            aspect: e.variant === "playlist" ? "audio-tall" : "audio",
          }
        : null;
    default:
      return null;
  }
}

const PROVIDER_NAMES = {
  youtube: "YouTube",
  x: "X",
  vimeo: "Vimeo",
  tiktok: "TikTok",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  link: "Link",
};

/**
 * "YouTube Short", "X post", "Spotify episode", "Link".
 *
 * @param {string} provider
 * @param {string | null} variant
 */
export function mediaLabel(provider, variant) {
  if (provider === "youtube") return variant === "short" ? "YouTube Short" : "YouTube video";
  if (provider === "x") return "X post";
  if (provider === "vimeo") return "Vimeo video";
  if (provider === "tiktok") return "TikTok video";
  if (provider === "spotify") return `Spotify ${variant ?? "item"}`;
  if (provider === "soundcloud") return variant === "playlist" ? "SoundCloud playlist" : "SoundCloud track";
  return PROVIDER_NAMES[/** @type {keyof typeof PROVIDER_NAMES} */ (provider)] ?? "Link";
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…" };

/** @param {string} text */
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[/** @type {keyof typeof ENTITIES} */ (code.toLowerCase())] ?? whole;
  });
}

/**
 * Markup → plain text: tags dropped (<br> and </p> become line breaks),
 * entities decoded, whitespace tidied.
 *
 * @param {string} html
 */
export function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]*>/g, "")
  )
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** @param {unknown} v @param {number} max */
function cleanText(v, max) {
  return typeof v === "string" ? htmlToText(v).slice(0, max) : "";
}

/** @param {unknown} v @param {string} [base] */
export function httpsUrl(v, base) {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    const u = new URL(decodeEntities(v.trim()), base);
    if (u.protocol !== "https:" || u.toString().length > MAX_URL_LENGTH) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * The fields we keep from a provider's oEmbed response — title, author,
 * thumbnail, and for X the post's text. Its `html` is only ever read as
 * text. Null when the response isn't usable.
 *
 * @param {string} provider
 * @param {unknown} json
 * @returns {MediaFields | null}
 */
export function oembedFields(provider, json) {
  if (!json || typeof json !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (json);
  const authorName = cleanText(o.author_name, 200) || null;
  const authorUrl = httpsUrl(o.author_url);
  if (provider === "x") {
    if (typeof o.html !== "string") return null;
    // The post is the first <p> of X's blockquote; the rest is the byline.
    const p = o.html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const text = cleanText(p ? p[1] : o.html, MAX_DESCRIPTION);
    const handle = authorUrl ? new URL(authorUrl).pathname.split("/").filter(Boolean)[0] ?? null : null;
    const firstLine = text.split("\n")[0] ?? "";
    return {
      title: `${authorName ?? (handle ? `@${handle}` : "Post")} on X${firstLine ? `: ${firstLine}` : ""}`.slice(0, MAX_TITLE),
      description: text,
      authorName,
      authorUrl,
      siteName: "X",
      imageUrl: null,
    };
  }
  const title = cleanText(o.title, MAX_TITLE);
  if (!title && !authorName) return null;
  return {
    title,
    description: cleanText(o.description, MAX_DESCRIPTION),
    authorName,
    authorUrl,
    siteName: cleanText(o.provider_name, 200) || PROVIDER_NAMES[/** @type {keyof typeof PROVIDER_NAMES} */ (provider)] || null,
    imageUrl: httpsUrl(o.thumbnail_url),
  };
}

/** @param {string} tag */
function attributes(tag) {
  /** @type {Record<string, string>} */
  const attrs = {};
  for (const m of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return attrs;
}

/**
 * A link card from a page's <head>: Open Graph, then Twitter card tags,
 * then <title> / meta description. Images must be https (relative ones are
 * resolved against the page). Site name falls back to the host.
 *
 * @param {string} html
 * @param {string} pageUrl
 * @returns {MediaFields}
 */
export function parseOpenGraph(html, pageUrl) {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd >= 0 ? html.slice(0, headEnd) : html;
  /** @type {Record<string, string>} */
  const meta = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    const key = (a.property ?? a.name ?? "").toLowerCase();
    if (key && a.content !== undefined && !(key in meta)) meta[key] = a.content;
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const host = new URL(pageUrl).hostname.replace(/^www\./, "");
  return {
    title: cleanText(meta["og:title"] || meta["twitter:title"] || titleTag, MAX_TITLE) || host,
    description: cleanText(meta["og:description"] || meta["twitter:description"] || meta.description, MAX_DESCRIPTION),
    authorName: cleanText(meta.author || meta["article:author"], 200) || null,
    authorUrl: null,
    siteName: cleanText(meta["og:site_name"], 200) || host,
    imageUrl:
      httpsUrl(meta["og:image:secure_url"], pageUrl) ??
      httpsUrl(meta["og:image"], pageUrl) ??
      httpsUrl(meta["twitter:image"] || meta["twitter:image:src"], pageUrl),
  };
}

/**
 * Whether an address must never be fetched from the server: loopback,
 * private, link-local (incl. cloud metadata), carrier-grade NAT, multicast,
 * reserved, and IPv6 forms of the same (incl. IPv4-mapped).
 *
 * @param {string} address
 */
export function isPrivateAddress(address) {
  const a = address.toLowerCase().replace(/^\[|\]$/g, "");
  const v4 = a.match(/^(?:::ffff:|::|64:ff9b::)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [o1, o2] = [Number(v4[1]), Number(v4[2])];
    return (
      o1 === 0 ||
      o1 === 10 ||
      o1 === 127 ||
      (o1 === 100 && o2 >= 64 && o2 <= 127) ||
      (o1 === 169 && o2 === 254) ||
      (o1 === 172 && o2 >= 16 && o2 <= 31) ||
      (o1 === 192 && o2 === 0) ||
      (o1 === 192 && o2 === 168) ||
      (o1 === 198 && (o2 === 18 || o2 === 19)) ||
      o1 >= 224
    );
  }
  if (!a.includes(":")) return true; // not an IP at all: refuse
  // IPv4-mapped written in hex (::ffff:7f00:1).
  const mapped = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const n = (parseInt(mapped[1], 16) << 16) | parseInt(mapped[2], 16);
    return isPrivateAddress([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
  }
  if (a === "::" || a === "::1") return true;
  const first = parseInt(a.split(":")[0] || "0", 16);
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (first & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (first & 0xff00) === 0xff00 || // ff00::/8 multicast
    first === 0 // ::/16-ish reserved forms
  );
}

/**
 * The reporter's note: trimmed, at most 280 characters, plain text.
 *
 * @param {unknown} note
 */
export function cleanNote(note) {
  return typeof note === "string" ? note.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE_LENGTH) : "";
}
