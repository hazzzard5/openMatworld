"use client";

import { useCallback, useMemo, useState } from "react";
import GlobeView from "./GlobeView";
import Sidebar from "./Sidebar";
import SubmitModal from "./SubmitModal";
import { bySoonest, filterGyms, isLiveNow } from "@/lib/gyms";
import type { Gym, Style } from "@/lib/types";

type Props = {
  initialGyms: Gym[];
  /** Rendered on the server so sponsor slots stay static markup. */
  sponsorRail: React.ReactNode;
};

export default function MapExperience({ initialGyms, sponsorRail }: Props) {
  const [gyms, setGyms] = useState(initialGyms);
  const [query, setQuery] = useState("");
  const [styles, setStyles] = useState<Style[]>([]);
  const [liveOnly, setLiveOnly] = useState(false);
  const [selected, setSelected] = useState<Gym | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);

  const visible = useMemo(
    () => bySoonest(filterGyms(gyms, { query, styles, liveOnly })),
    [gyms, query, styles, liveOnly],
  );

  const countries = useMemo(() => new Set(gyms.map((g) => g.country)).size, [gyms]);
  const liveCount = useMemo(() => gyms.filter((g) => isLiveNow(g)).length, [gyms]);

  const toggleStyle = useCallback((style: Style) => {
    setStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style],
    );
  }, []);

  const handleAdded = useCallback((gym: Gym) => {
    setGyms((prev) => [...prev, gym]);
    setSelected(gym);
  }, []);

  return (
    <div className="flex flex-col lg:grid lg:h-dvh lg:grid-cols-[340px_minmax(0,1fr)_280px]">
      {/* Globe comes first in the DOM so mobile shows it above the fold;
          on desktop the grid moves it into the middle column. */}
      <main className="relative h-[52svh] min-h-0 lg:col-start-2 lg:row-start-1 lg:h-auto">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(63,125,255,0.1),transparent_62%)]" />
        <GlobeView gyms={visible} selected={selected} onSelect={setSelected} />

        {visible.length !== gyms.length && (
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-ink-700 bg-ink-900/90 px-3.5 py-1.5 text-[11.5px] text-ink-300 backdrop-blur">
            Showing {visible.length} of {gyms.length} mats
          </div>
        )}
      </main>

      <div className="h-[78svh] min-h-0 lg:col-start-1 lg:row-start-1 lg:h-auto">
        <Sidebar
          gyms={visible}
          total={gyms.length}
          countries={countries}
          liveCount={liveCount}
          query={query}
          onQuery={setQuery}
          styles={styles}
          onToggleStyle={toggleStyle}
          liveOnly={liveOnly}
          onToggleLive={() => setLiveOnly((v) => !v)}
          selected={selected}
          onSelect={setSelected}
          onSubmit={() => setSubmitOpen(true)}
        />
      </div>

      <div className="min-h-0 lg:col-start-3 lg:row-start-1">{sponsorRail}</div>

      <SubmitModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onAdded={handleAdded}
      />
    </div>
  );
}
