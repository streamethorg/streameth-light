import OfflinePageList from "@/components/OfflinePageList";

export const metadata = {
  title: "Offline — StreamETH",
  robots: { index: false },
};

// Served by the service worker in place of any page that wasn't saved before
// the connection dropped.
export default function OfflinePage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="display text-3xl text-ink">You&apos;re offline</h1>
        <p className="text-sm text-ink-dim">
          This page wasn&apos;t saved on this device. These ones were — they open without a connection.
        </p>
      </div>
      <OfflinePageList />
    </div>
  );
}
