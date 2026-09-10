import MapExperience from "@/components/MapExperience";
import SponsorRail from "@/components/SponsorRail";
import { listGyms, listSponsors } from "@/lib/store";

// Submissions change the map, so don't serve a stale prerender.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [gyms, sponsors] = await Promise.all([listGyms("approved"), listSponsors()]);

  return <MapExperience initialGyms={gyms} sponsorRail={<SponsorRail sponsors={sponsors} />} />;
}
