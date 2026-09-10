"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import dynamic from "next/dynamic";
import * as THREE from "three";
import type { Gym } from "@/lib/types";
import { isLiveNow } from "@/lib/gyms";

const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => null,
});

type CountryFeature = { properties: { name: string }; geometry: unknown };

type Props = {
  gyms: Gym[];
  selected: Gym | null;
  onSelect: (gym: Gym | null) => void;
};

const LIVE = "#37e0a0";
const MAT = "#ff5b2e";

export default function GlobeView({ gyms, selected, onSelect }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<Gym | null>(null);
  // Re-evaluate "live now" every minute so dots go green as sessions start.
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/countries-110m.geojson")
      .then((r) => r.json())
      .then((geo: { features: CountryFeature[] }) => {
        if (!cancelled) setCountries(geo.features);
      })
      .catch(() => {
        /* The globe still works without landmasses, just emptier. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Track the container so the canvas fills whatever space the layout gives it.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => {
    void tick;
    return gyms.map((gym) => ({ gym, live: isLiveNow(gym) }));
  }, [gyms, tick]);

  type Point = (typeof points)[number];

  // Only live sessions get a pulsing ring — otherwise the globe is noise.
  const rings = useMemo(
    () => points.filter((p) => p.live).map((p) => ({ lat: p.gym.lat, lng: p.gym.lng })),
    [points],
  );

  const globeMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: "#0b1020",
        emissive: "#060a14",
        shininess: 6,
        transparent: true,
        opacity: 0.96,
      }),
    [],
  );

  // Spin idly, but stop the moment someone is actually looking at something.
  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (!controls) return;
    controls.autoRotate = !selected && !hovered;
    controls.autoRotateSpeed = 0.32;
  }, [ready, selected, hovered]);

  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (!controls) return;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.enablePan = false;
    controls.minDistance = 180;
    controls.maxDistance = 620;
  }, [ready]);

  // Fly to whatever the sidebar selected.
  useEffect(() => {
    if (!ready || !selected) return;
    globeRef.current?.pointOfView(
      { lat: selected.lat, lng: selected.lng, altitude: 1.15 },
      1000,
    );
  }, [ready, selected]);

  const handleReady = () => {
    setReady(true);
    const globe = globeRef.current;
    if (!globe) return;
    globe.pointOfView({ lat: 18, lng: 8, altitude: 2.4 }, 0);
    // A little rim light makes the sphere read as a sphere.
    const light = new THREE.DirectionalLight("#8fb4ff", 0.55);
    light.position.set(-1, 0.6, 1);
    globe.lights([...globe.lights(), light]);
  };

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      {size.width > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          onGlobeReady={handleReady}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={globeMaterial}
          showAtmosphere
          atmosphereColor="#3f7dff"
          atmosphereAltitude={0.17}
          hexPolygonsData={countries}
          hexPolygonResolution={3}
          hexPolygonMargin={0.55}
          hexPolygonUseDots
          hexPolygonAltitude={0.006}
          hexPolygonColor={() => "rgba(122,146,192,0.42)"}
          hexPolygonsTransitionDuration={600}
          pointsData={points}
          pointLat={(d) => (d as Point).gym.lat}
          pointLng={(d) => (d as Point).gym.lng}
          pointAltitude={(d) => {
            const p = d as Point;
            if (selected?.id === p.gym.id) return 0.09;
            return p.live ? 0.055 : 0.028;
          }}
          pointRadius={(d) => {
            const p = d as Point;
            if (selected?.id === p.gym.id) return 0.55;
            return p.live ? 0.42 : 0.3;
          }}
          pointColor={(d) => {
            const p = d as Point;
            if (selected?.id === p.gym.id) return "#ffffff";
            return p.live ? LIVE : MAT;
          }}
          pointsMerge={false}
          pointsTransitionDuration={300}
          pointLabel={(d) => {
            const { gym, live } = d as Point;
            return `
              <div style="
                background:rgba(9,13,22,.94);
                border:1px solid rgba(107,121,148,.35);
                border-radius:10px;
                padding:8px 11px;
                font:500 12px/1.35 ui-sans-serif,system-ui,sans-serif;
                color:#c3ccdc;
                box-shadow:0 8px 30px rgba(0,0,0,.5);
                max-width:230px;
              ">
                <div style="color:#fff;font-weight:650;margin-bottom:2px">${escapeHtml(gym.name)}</div>
                <div style="color:#93a0b8">${escapeHtml(gym.city)}, ${escapeHtml(gym.country)}</div>
                ${
                  live
                    ? `<div style="color:${LIVE};margin-top:4px;font-weight:600">● Rolling right now</div>`
                    : ""
                }
              </div>`;
          }}
          onPointClick={(d) => onSelect((d as Point).gym)}
          onPointHover={(d) => setHovered(d ? (d as Point).gym : null)}
          ringsData={rings}
          ringColor={() => (t: number) => `rgba(55,224,160,${1 - t})`}
          ringMaxRadius={2.6}
          ringPropagationSpeed={1.4}
          ringRepeatPeriod={900}
          onGlobeClick={() => onSelect(null)}
        />
      )}

      {!ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-2 text-xs tracking-wide text-ink-400 uppercase">
            <span className="size-1.5 animate-pulse rounded-full bg-mat-500" />
            Spinning up the globe
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
