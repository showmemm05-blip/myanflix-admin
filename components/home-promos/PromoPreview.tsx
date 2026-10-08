import Image from "next/image";
import { PromoArt } from "@/components/home-promos/PromoArt";
import type { HomePromoArtPreset, HomePromoCtaTarget, HomePromoKind } from "@/types/home-promo";
import { cn } from "@/lib/utils";

interface PromoPreviewProps {
  kind: HomePromoKind;
  artPreset: HomePromoArtPreset;
  /** The uploaded (or about-to-be-uploaded) image; replaces the drawn art. */
  imageUrl: string | null;
  /** A spotlight without its own image falls back to the title's artwork. */
  fallbackImageUrl?: string | null;
  kicker: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaTarget: HomePromoCtaTarget;
  dateText: string;
  className?: string;
}

/**
 * A small, honest approximation of how the promo reads in the apps: the art
 * (or image) full-bleed under the same dark gradients the boards use, with
 * the text bottom-left. It is a guide for wording and art choice, not a
 * pixel copy of every screen size.
 */
export function PromoPreview({
  kind,
  artPreset,
  imageUrl,
  fallbackImageUrl,
  kicker,
  title,
  body,
  ctaLabel,
  ctaTarget,
  dateText,
  className,
}: PromoPreviewProps) {
  const picture = imageUrl ?? (kind === "SPOTLIGHT" ? fallbackImageUrl ?? null : null);
  const showButton = kind === "HERO" && ctaTarget !== "NONE" && !!ctaLabel;
  const buttonClass =
    ctaTarget === "SUBSCRIBE" ? "bg-[#F5C451] text-[#1F1600]" : "bg-[#E0181F] text-white";

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg bg-[#08080B] text-white",
        className,
      )}
    >
      {picture ? (
        <Image src={picture} alt="" fill sizes="480px" className="object-cover" unoptimized />
      ) : (
        <PromoArt preset={artPreset} />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(8,8,11,0.88) 0%, rgba(8,8,11,0.55) 34%, rgba(8,8,11,0) 64%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background: "linear-gradient(180deg, rgba(8,8,11,0) 0%, rgba(8,8,11,0.8) 60%, #08080B 100%)",
        }}
      />
      {kind === "COMING_SOON" && dateText && (
        <span className="absolute left-3 top-3 rounded bg-[#E0181F]/90 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
          {dateText}
        </span>
      )}
      <div className="absolute inset-x-3 bottom-3 flex max-w-[70%] flex-col gap-1">
        {kicker && (
          <p className="truncate text-[10px] font-extrabold uppercase tracking-wider text-[#FF4D55]">
            {kicker}
          </p>
        )}
        <p className="line-clamp-2 text-base font-extrabold leading-tight">{title || "—"}</p>
        {body && <p className="line-clamp-2 text-[11px] leading-snug text-[#D9D9E0]">{body}</p>}
        {showButton && (
          <span
            className={cn(
              "mt-1 inline-flex h-6 w-fit items-center rounded-md px-2.5 text-[11px] font-extrabold",
              buttonClass,
            )}
          >
            {ctaLabel}
          </span>
        )}
      </div>
    </div>
  );
}
