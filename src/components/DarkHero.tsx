import { cn, tint } from "@/lib/utils";

type Props = {
  as?: "header" | "section";
  className?: string;
  /** Accent for the big radial glow — defaults to the logo magenta. */
  accent?: string;
  children: React.ReactNode;
};

/**
 * Shared dark hero surface: deep violet-navy with two radial glows pulled
 * from the logo gradient. Rounded corners are passed via className so each
 * page controls its own silhouette; glows are clipped to it.
 */
export default function DarkHero({
  as: Tag = "section",
  className,
  accent = "#B919D2",
  children,
}: Props) {
  return (
    <Tag className={cn("relative bg-midnight text-white", className)}>
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(90rem 42rem at 18% 130%, ${tint(
              accent,
              0.38
            )}, transparent 62%), radial-gradient(55rem 30rem at 88% -30%, ${tint(
              "#7C3AED",
              0.3
            )}, transparent 60%)`,
          }}
        />
      </div>
      <div className="relative">{children}</div>
    </Tag>
  );
}
