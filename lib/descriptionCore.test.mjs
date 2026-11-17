import { test } from "node:test";
import assert from "node:assert/strict";
import { boilerplateKeys, cleanDescription } from "./descriptionCore.mjs";

const promo =
  "Visit the https://archive.devcon.org/ to gain access to the entire library of Devcon talks with the ease of filtering, playlists, personalized suggestions, decentralized access on IPFS and more.\nhttps://archive.devcon.org/archive/watch/6/";
const footer = "Follow us: https://twitter.com/efdevcon, https://twitter.com/ethereum\nLearn more about devcon: https://www.devcon.org/";

test("a channel's repeated promo and footer paragraphs are dropped", () => {
  const descriptions = ["a", "b", "c"].map((slug) => `${promo}${slug}/index\n\nTalk ${slug} about zk.\n\n${footer}`);
  const keys = boilerplateKeys(descriptions);
  assert.equal(cleanDescription(descriptions[0], keys), "Talk a about zk.");
});

test("panelist lines keep names and companies, lose the links", () => {
  const text =
    "PANEL ALERT!\n\nPanelists:\nAd Cv https://twitter.com/adcv_, Co-founder/Chef, Steakhouse Financial https://twitter.com/SteakhouseFi.\nSamrat Lekhak https://twitter.com/SamExotic3, Growth Manager, Liquity https://twitter.com/LiquityProtocol.";
  assert.equal(
    cleanDescription(text),
    "PANEL ALERT! Panelists: Ad Cv, Co-founder/Chef, Steakhouse Financial. Samrat Lekhak, Growth Manager, Liquity."
  );
});

test("label-only link lines go; nothing left means empty", () => {
  assert.equal(cleanDescription("Website: https://swarm.ethereum.org/\nDiscord: https://discord.gg/x"), "");
  assert.equal(cleanDescription("Slides: https://x.io/s\nWe present a ZK proof of inference."), "We present a ZK proof of inference.");
});

test("a description without boilerplate or links is unchanged apart from spacing", () => {
  assert.equal(cleanDescription("Justin Drake talks about VDFs.\n\nSpeaker(s): Justin Drake"), "Justin Drake talks about VDFs. Speaker(s): Justin Drake.");
});
