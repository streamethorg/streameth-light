import { initials, tagColorFor } from "@/lib/format";

/** Photo avatar, or a colored initials circle using the same deterministic
 * tag-color set as CoverPlaceholder — so channel/speaker identities read as
 * part of the same colorful system as video covers, not a flat gray box. */
export default function Avatar({
  name,
  photo,
  className = "",
}: {
  name: string;
  photo?: string | null;
  className?: string;
}) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className={`rounded-full object-cover ${className}`} />;
  }

  const color = tagColorFor(name);
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-bold ${className}`}
      style={{
        backgroundColor: `color-mix(in srgb, var(--color-${color}) 18%, var(--color-panel-raised))`,
        color: `var(--color-${color})`,
      }}
    >
      {initials(name)}
    </div>
  );
}
