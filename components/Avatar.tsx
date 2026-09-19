import { avatarUrl } from "@/lib/avatar";
import { userColor } from "@/lib/colors";

export function Avatar({
  style,
  seed,
  size = 32,
  colorIndex,
  title,
}: {
  style: string;
  seed: string;
  size?: number;
  colorIndex?: number;
  title?: string;
}) {
  const ring = colorIndex === undefined ? "var(--border-strong)" : userColor(colorIndex).solid;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl(style, seed)}
      alt={title ?? "头像"}
      title={title}
      width={size}
      height={size}
      className="rounded-full bg-subtle object-cover"
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${ring}` }}
    />
  );
}
