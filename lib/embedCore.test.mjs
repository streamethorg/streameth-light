import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanNote,
  htmlToText,
  isPrivateAddress,
  matchMedia,
  mediaLabel,
  oembedFields,
  oembedUrl,
  parseOpenGraph,
  playerFor,
} from "./embedCore.mjs";

const pick = (raw) => {
  const m = matchMedia(raw);
  return m && { provider: m.provider, id: m.externalId, url: m.canonicalUrl, variant: m.variant };
};

test("YouTube links in every common shape become one canonical video", () => {
  const watch = { provider: "youtube", id: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", variant: null };
  assert.deepEqual(pick("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123"), watch);
  assert.deepEqual(pick("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), watch);
  assert.deepEqual(pick("youtu.be/dQw4w9WgXcQ?si=abc"), watch);
  assert.deepEqual(pick("http://youtube.com/live/dQw4w9WgXcQ"), watch);
  assert.deepEqual(pick("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"), watch);
  assert.deepEqual(pick("https://www.youtube.com/shorts/dQw4w9WgXcQ"), {
    provider: "youtube",
    id: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    variant: "short",
  });
});

test("YouTube pages that aren't one video are plain links", () => {
  assert.equal(pick("https://www.youtube.com/@ethglobal")?.provider, "link");
  assert.equal(pick("https://www.youtube.com/playlist?list=PL123")?.provider, "link");
  assert.equal(pick("https://www.youtube.com/watch?v=short")?.provider, "link");
});

test("X and Twitter status links normalise to x.com", () => {
  const post = { provider: "x", id: "1849000000000000000", url: "https://x.com/VitalikButerin/status/1849000000000000000", variant: null };
  assert.deepEqual(pick("https://twitter.com/VitalikButerin/status/1849000000000000000?s=20&t=abc"), post);
  assert.deepEqual(pick("https://mobile.twitter.com/VitalikButerin/status/1849000000000000000"), post);
  assert.deepEqual(pick("https://x.com/VitalikButerin/status/1849000000000000000/photo/1"), post);
  assert.deepEqual(pick("https://x.com/i/web/status/1849000000000000000"), {
    ...post,
    url: "https://x.com/i/web/status/1849000000000000000",
  });
  assert.equal(pick("https://x.com/VitalikButerin")?.provider, "link");
});

test("Vimeo, TikTok, Spotify and SoundCloud items are recognised", () => {
  assert.deepEqual(pick("https://vimeo.com/76979871"), { provider: "vimeo", id: "76979871", url: "https://vimeo.com/76979871", variant: null });
  assert.deepEqual(pick("https://vimeo.com/76979871/a1b2c3d4e5"), {
    provider: "vimeo",
    id: "76979871/a1b2c3d4e5",
    url: "https://vimeo.com/76979871/a1b2c3d4e5",
    variant: null,
  });
  assert.equal(pick("https://vimeo.com/channels/staffpicks/76979871")?.id, "76979871");
  assert.deepEqual(pick("https://www.tiktok.com/@ethglobal/video/7300000000000000000?lang=en"), {
    provider: "tiktok",
    id: "7300000000000000000",
    url: "https://www.tiktok.com/@ethglobal/video/7300000000000000000",
    variant: "short",
  });
  assert.deepEqual(pick("https://open.spotify.com/intl-de/episode/4rOoJ6Egrf8K2IrywzwOMk?si=x"), {
    provider: "spotify",
    id: "episode/4rOoJ6Egrf8K2IrywzwOMk",
    url: "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk",
    variant: "episode",
  });
  assert.deepEqual(pick("https://soundcloud.com/bankless/some-episode?in=x"), {
    provider: "soundcloud",
    id: "bankless/some-episode",
    url: "https://soundcloud.com/bankless/some-episode",
    variant: "track",
  });
  assert.equal(pick("https://soundcloud.com/bankless")?.provider, "link");
});

test("other https pages are link cards without their fragment", () => {
  assert.deepEqual(pick("https://blog.ethereum.org/2026/10/01/devcon#top"), {
    provider: "link",
    id: null,
    url: "https://blog.ethereum.org/2026/10/01/devcon",
    variant: null,
  });
  // Short links are cards too; the server follows them safely and re-matches.
  assert.equal(pick("https://t.co/abc123")?.provider, "link");
});

test("unsafe or malformed links are refused", () => {
  for (const bad of [
    "",
    "not a url",
    "javascript:alert(1)",
    "data:text/html,hi",
    "file:///etc/passwd",
    "ftp://example.com/x",
    "https://user:pw@example.com/",
    "https://example.com:8443/",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://localhost/",
    `https://example.com/${"a".repeat(2100)}`,
  ]) {
    assert.equal(matchMedia(bad), null, bad);
  }
});

test("oEmbed endpoints are the providers' public ones", () => {
  assert.equal(
    oembedUrl(matchMedia("https://www.youtube.com/shorts/dQw4w9WgXcQ")),
    "https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ"
  );
  assert.match(oembedUrl(matchMedia("https://x.com/a/status/1")), /^https:\/\/publish\.twitter\.com\/oembed\?omit_script=1&dnt=true&url=/);
  assert.equal(oembedUrl(matchMedia("https://example.com/")), null);
});

test("players are built from ids, sized by kind", () => {
  assert.deepEqual(playerFor({ provider: "youtube", externalId: "dQw4w9WgXcQ", url: "", variant: "short" }), {
    src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1",
    aspect: "vertical",
  });
  assert.equal(
    playerFor({ provider: "vimeo", externalId: "76979871/a1b2c3d4e5", url: "", variant: null })?.src,
    "https://player.vimeo.com/video/76979871?dnt=1&autoplay=1&h=a1b2c3d4e5"
  );
  assert.equal(playerFor({ provider: "spotify", externalId: "episode/4rOoJ6Egrf8K2IrywzwOMk", url: "", variant: "episode" })?.aspect, "audio");
  assert.equal(playerFor({ provider: "x", externalId: "1", url: "", variant: null }), null);
  assert.equal(playerFor({ provider: "link", externalId: null, url: "", variant: null }), null);
  // A tampered id never reaches an iframe.
  assert.equal(playerFor({ provider: "youtube", externalId: '"><script>', url: "", variant: null }), null);
});

test("labels name the kind of media", () => {
  assert.equal(mediaLabel("youtube", "short"), "YouTube Short");
  assert.equal(mediaLabel("x", null), "X post");
  assert.equal(mediaLabel("spotify", "episode"), "Spotify episode");
  assert.equal(mediaLabel("link", null), "Link");
});

test("X oEmbed: text from the post, handle from author_url, markup dropped", () => {
  const fields = oembedFields("x", {
    author_name: "Vitalik Buterin",
    author_url: "https://twitter.com/VitalikButerin",
    html: '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Devcon 8 &amp; the <a href="https://t.co/x">future</a><br>of L2s <script>alert(1)</script></p>&mdash; Vitalik Buterin (@VitalikButerin) <a href="https://twitter.com/x">Oct 1</a></blockquote>',
  });
  assert.equal(fields.description, "Devcon 8 & the future\nof L2s");
  assert.equal(fields.title, "Vitalik Buterin on X: Devcon 8 & the future");
  assert.equal(fields.authorUrl, "https://twitter.com/VitalikButerin");
  assert.equal(fields.imageUrl, null);
});

test("video oEmbed: title, author, https thumbnail only", () => {
  const fields = oembedFields("youtube", {
    title: "ETHGlobal Tokyo <b>Recap</b>",
    author_name: "ETHGlobal",
    author_url: "https://www.youtube.com/@ETHGlobal",
    provider_name: "YouTube",
    thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  });
  assert.deepEqual(fields, {
    title: "ETHGlobal Tokyo Recap",
    description: "",
    authorName: "ETHGlobal",
    authorUrl: "https://www.youtube.com/@ETHGlobal",
    siteName: "YouTube",
    imageUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  });
  assert.equal(oembedFields("vimeo", { title: "x", thumbnail_url: "http://insecure/x.jpg" }).imageUrl, null);
  assert.equal(oembedFields("youtube", "nope"), null);
  assert.equal(oembedFields("youtube", {}), null);
  assert.equal(oembedFields("x", { author_name: "a" }), null);
});

test("Open Graph cards: og tags first, then twitter and <title>; relative images resolved", () => {
  const html = `<!doctype html><html><head>
    <title>Fallback &amp; title</title>
    <meta property="og:title" content="Devcon 8 tickets are live">
    <meta name="description" content="Plain description">
    <meta property="og:image" content="/img/card.png">
    <meta property="og:site_name" content='Ethereum Foundation Blog'>
  </head><body><meta property="og:title" content="ignored in body"></body></html>`;
  assert.deepEqual(parseOpenGraph(html, "https://blog.ethereum.org/2026/10/devcon"), {
    title: "Devcon 8 tickets are live",
    description: "Plain description",
    authorName: null,
    authorUrl: null,
    siteName: "Ethereum Foundation Blog",
    imageUrl: "https://blog.ethereum.org/img/card.png",
  });
  const bare = parseOpenGraph("<html><head><title>Just a title</title></head></html>", "https://www.example.org/x");
  assert.equal(bare.title, "Just a title");
  assert.equal(bare.siteName, "example.org");
  assert.equal(bare.imageUrl, null);
  assert.equal(parseOpenGraph("", "https://example.org/").title, "example.org");
  const insecure = parseOpenGraph('<meta property="og:image" content="http://x.org/a.png">', "https://x.org/");
  assert.equal(insecure.imageUrl, null);
});

test("private and internal addresses are refused", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "[::1]",
    "not-an-ip",
  ]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "104.16.1.1", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test("text helpers", () => {
  assert.equal(htmlToText("<p>a&nbsp;b</p><p>c &#x2014; &#8217;d</p>"), "a b\nc — ’d");
  assert.equal(cleanNote("  why   this\nmatters  "), "why this matters");
  assert.equal(cleanNote("x".repeat(400)).length, 280);
  assert.equal(cleanNote(42), "");
});
