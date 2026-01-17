import { apiJson } from '$lib/api';

interface Assignment {
  id: string | null;
  role_id: string;
  role_name: string;
  ministry_area: string;
  person_id: string | null;
  person_name: string | null;
  status: string;
  is_lead: boolean;
  is_required: boolean;
  notes: string | null;
}

interface Song {
  id: string;
  song_id: string;
  title: string;
  artist: string | null;
  key: string | null;
  bpm: number | null;
  display_order: number;
  notes: string | null;
}

interface ServiceDetail {
  id: string;
  service_time: string;
  campus_name: string | null;
  group_date: string;
  service_name: string;
  context_name: string;
}

interface AvailableSong {
  id: string;
  title: string;
  artist: string | null;
  key: string | null;
  bpm: number | null;
}

export const load = async ({ params, fetch }) => {
  const serviceId = params.id;

  const [service, assignments, songs, availableSongs] = await Promise.all([
    apiJson<ServiceDetail>(fetch, `/api/gatherings/${serviceId}`),
    apiJson<Assignment[]>(fetch, `/api/gatherings/${serviceId}/roster`),
    apiJson<Song[]>(fetch, `/api/gatherings/${serviceId}/songs`),
    apiJson<AvailableSong[]>(fetch, '/api/songs')
  ]);

  return {
    service,
    assignments,
    songs,
    availableSongs,
    serviceId
  };
};
