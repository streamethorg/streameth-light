// How the condensed cut sits inside the graphics timeline. The talk starts
// on the first frame (its title is a lower third over the opening seconds);
// the closing card fades in over the cut's last FADE_S.
//
//   [ cut ............................................ ][ closing card ]
export const FADE_S = 0.5;
export const OUTRO_S = 5;
// When the lower third comes on and how long it stays up.
export const LOWER_THIRD_IN_S = 0.6;
export const LOWER_THIRD_S = 6;

export interface Timeline {
  fadeFrames: number;
  videoFrames: number;
  outroFrames: number;
  // First frame of the closing card (it overlaps the cut's last fadeFrames).
  outroFrom: number;
  totalFrames: number;
}

export function timeline(fps: number, videoDurationS: number): Timeline {
  const fadeFrames = Math.round(FADE_S * fps);
  const videoFrames = Math.floor(videoDurationS * fps);
  const outroFrames = Math.round(OUTRO_S * fps);
  const outroFrom = videoFrames - fadeFrames;
  return { fadeFrames, videoFrames, outroFrames, outroFrom, totalFrames: outroFrom + outroFrames };
}
