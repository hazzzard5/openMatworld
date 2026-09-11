import MapExperience from "@/components/MapExperience";
import SponsorRail from "@/components/SponsorRail";
import { listGyms, listSponsors } from "@/lib/store";
import type { Gym } from "@/lib/types";

// Submissions change the map, so don't serve a stale prerender.
export const dynamic = "force-dynamic";

export default async function Home() {
  let gyms: Gym[] = [];
  let loadFailed = false;

  // A transient database blip shouldn't replace the whole site with an error
  // page. Render the globe and say so instead — an empty map with no
  // explanation would read as "there are no open mats", which is worse.
  try {
    gyms = await listGyms("approved");
  } catch (err) {
    console.error("Could not load gyms", err);
    loadFailed = true;
  }

  const sponsors = await listSponsors();

  return (
    <MapExperience
      initialGyms={gyms}
      loadFailed={loadFailed}
      sponsorRail={<SponsorRail sponsors={sponsors} />}
    />
  );
}
