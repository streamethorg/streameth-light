import Link from "next/link";
import { listOrganizations, getOrgSessionCount, listAllSessions } from "@/lib/data";

export default function Home() {
  const organizations = listOrganizations()
    .map((o) => ({ org: o, count: getOrgSessionCount(o._id) }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count);

  const totalVideos = listAllSessions().length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">StreamETH Light</h1>
        <p className="max-w-2xl text-sm text-neutral-400">
          A read-only archive of the StreamETH video library — {totalVideos}{" "}
          public talks across {organizations.length} organizations.
        </p>
        <Link
          href="/videos"
          className="w-fit rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800"
        >
          Browse all videos →
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {organizations.map(({ org, count }) => (
          <Link
            key={org._id}
            href={`/${org.slug}`}
            className="group flex flex-col gap-3 rounded-lg border border-neutral-800 p-4 hover:border-neutral-600"
          >
            <div className="flex h-16 items-center">
              {org.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={org.logo}
                  alt={org.name}
                  className="max-h-16 w-auto max-w-full object-contain"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800 text-lg font-medium">
                  {org.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-sm font-medium text-neutral-100 group-hover:text-white">
                {org.name}
              </h2>
              <p className="text-xs text-neutral-500">
                {count} video{count === 1 ? "" : "s"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
