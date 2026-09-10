import MapExperience from "@/components/MapExperience";
import SponsorRail from "@/components/SponsorRail";
import { listGyms } from "@/lib/store";

// Submissions change the map, so don't serve a stale prerender.
export const dynamic = "force-dynamic";

export default async function Home() {
  const gyms = await listGyms("approved");

  return <MapExperience initialGyms={gyms} sponsorRail={<SponsorRail />} />;
}
