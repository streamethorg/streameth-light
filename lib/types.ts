export interface Organization {
  _id: string;
  name: string;
  logo?: string;
  banner?: string;
  slug: string;
  accentColor?: string;
  location?: string;
  description?: string;
  url?: string;
}

export interface Event {
  _id: string;
  name: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  logo?: string;
  banner?: string;
  eventCover?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  organizationId: string;
  accentColor?: string;
  slug: string;
  unlisted?: boolean;
}

export interface Stage {
  _id: string;
  name: string;
  eventId: string;
  organizationId: string;
  order?: number;
  slug: string;
}

export interface SessionSpeaker {
  _id: string;
  name: string;
  bio?: string;
  twitter?: string;
  github?: string;
  website?: string;
  photo?: string;
  company?: string;
}

export interface Session {
  _id: string;
  name: string;
  description?: string;
  start: number;
  end: number;
  stageId: string;
  speakers: SessionSpeaker[];
  playback?: {
    videoUrl?: string;
    format?: string;
    duration?: number;
  };
  videoUrl?: string;
  playbackId?: string;
  eventId: string;
  coverImage?: string;
  slug: string;
  organizationId: string;
  eventSlug: string;
  autoLabels?: string[];
  talkType?: string;
  aiDescription?: string;
  track?: string | string[];
  transcripts?: {
    subtitleUrl?: string;
    text?: string;
  };
  published?: string;
}

export interface Speaker {
  _id: string;
  name: string;
  bio?: string;
  eventId: string;
  twitter?: string;
  github?: string;
  website?: string;
  photo?: string;
  company?: string;
  slug: string;
}
