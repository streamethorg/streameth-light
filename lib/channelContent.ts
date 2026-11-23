import { getOrganization, listEventsForOrg } from "@/lib/data";
import { getOrphanSessionsForOrg } from "@/lib/orphanSessions";
import { allEventsForChannel } from "@/lib/season";
import { getYoutubeVideosForChannel } from "@/lib/youtube";

/** A channel page with nothing on it: no calendar edition, no StreamETH
 * event, no orphaned session and no YouTube upload. Its page only says "No
 * editions … yet", so it is noindexed and left out of the sitemap until
 * something lands (Search Console counts these as thin, crawled-not-indexed
 * pages). */
export function channelIsEmpty(slug: string): boolean {
  if (allEventsForChannel(slug).length > 0) return false;
  if (getYoutubeVideosForChannel(slug).length > 0) return false;
  const org = getOrganization(slug);
  if (org && (listEventsForOrg(org._id).length > 0 || getOrphanSessionsForOrg(org._id).length > 0)) return false;
  return true;
}
