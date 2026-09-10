import sponsorData from "../../data/sponsors.json";

type SponsorSlot = {
  id: string;
  name: string;
  tagline?: string;
  url: string;
  logo?: string;
  tier: "headline" | "standard";
  placeholder?: boolean;
};

const sponsors = sponsorData as SponsorSlot[];

/**
 * The right-hand rail. Empty slots read as an invitation rather than a gap,
 * so the layout looks intentional before the first sponsor signs.
 */
export default function SponsorRail() {
  const headline = sponsors.filter((s) => s.tier === "headline");
  const standard = sponsors.filter((s) => s.tier === "standard");

  return (
    <aside className="flex min-h-0 flex-col border-t border-ink-800 bg-ink-900/80 backdrop-blur lg:h-full lg:border-t-0 lg:border-l">
      <div className="scroll-slim min-h-0 flex-1 space-y-4 px-4 py-5 lg:overflow-y-auto">
        <p className="text-[10.5px] tracking-[0.14em] text-ink-400 uppercase">Supported by</p>

        {headline.map((s) => (
          <SponsorCard key={s.id} sponsor={s} />
        ))}

        {standard.length > 0 && (
          <>
            <div className="h-px bg-ink-800" />
            <div className="space-y-3">
              {standard.map((s) => (
                <SponsorCard key={s.id} sponsor={s} />
              ))}
            </div>
          </>
        )}

        <div className="rounded-xl border border-dashed border-ink-700 px-4 py-5">
          <p className="text-[12.5px] leading-relaxed text-ink-300">
            Grapplers plan their trips here. Put your gi, rashguard, camp or seminar in
            front of them.
          </p>
          <a
            href="mailto:sponsors@openmat.world?subject=Sponsoring%20Open%20Mat%20World"
            className="mt-3 inline-block rounded-lg border border-ink-600 px-3 py-1.5 text-[12px] font-medium text-ink-200 transition hover:border-mat-500 hover:text-mat-300"
          >
            Sponsor this space
          </a>
        </div>
      </div>

      <footer className="border-t border-ink-800 px-4 py-3">
        <p className="text-[11px] text-ink-400">
          Community-run. Listings are free and always will be.
        </p>
      </footer>
    </aside>
  );
}

function SponsorCard({ sponsor }: { sponsor: SponsorSlot }) {
  const headline = sponsor.tier === "headline";
  const initials = sponsor.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <a
      href={sponsor.url}
      target={sponsor.url.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer sponsored"
      className={`block rounded-xl border px-4 transition ${
        sponsor.placeholder
          ? "border-ink-800 bg-ink-850/60 hover:border-ink-600"
          : "border-ink-700 bg-ink-850 hover:border-mat-500/60"
      } ${headline ? "py-5" : "py-3.5"}`}
    >
      <div className="flex items-center gap-3">
        {sponsor.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sponsor.logo}
            alt=""
            className={headline ? "h-9 w-auto" : "h-7 w-auto"}
          />
        ) : (
          <span
            className={`grid shrink-0 place-items-center rounded-lg border border-ink-700 font-semibold text-ink-400 ${
              headline ? "size-10 text-[13px]" : "size-8 text-[11px]"
            }`}
          >
            {initials}
          </span>
        )}
        <span className="min-w-0">
          <span
            className={`block truncate font-semibold text-white ${
              headline ? "text-[14px]" : "text-[13px]"
            }`}
          >
            {sponsor.name}
          </span>
          {sponsor.tagline && (
            <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-400">
              {sponsor.tagline}
            </span>
          )}
        </span>
      </div>
    </a>
  );
}
