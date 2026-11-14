// The CalmOwe "Level C" mark: a bold C with a level bar through it, like a balanced
// scale. One source of truth for the geometry, shared by the in-app logo, the favicon,
// the home-screen icon and the link-preview image.

export const MARK_VIEWBOX = "0 0 32 32";
export const MARK_ARC = "M23.8 9.2A10 10 0 1 0 23.8 22.8";
export const MARK_BAR = "M15.5 16H28";
export const MARK_STROKE = 3.6;

/** The mark in `currentColor`. Size it with `className` (e.g. "size-4") or width/height. */
export function LogoMark({
  className,
  size,
  title,
}: {
  className?: string;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={MARK_STROKE}
      strokeLinecap="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-logo-mark=""
    >
      <path d={MARK_ARC} />
      <path d={MARK_BAR} />
    </svg>
  );
}
