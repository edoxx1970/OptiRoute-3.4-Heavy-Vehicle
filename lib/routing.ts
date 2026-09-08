export type Point = { lat: number; lon: number };

export type RouteLeg = {
  distanceKm: number;
  durationMinutes: number;
};

export type RoutingMatrix = {
  distancesKm: number[][];
  durationsMinutes: number[][];
  source: string;
};

function key(a: Point, b: Point) {
  return `${a.lat.toFixed(5)},${a.lon.toFixed(5)}:${b.lat.toFixed(5)},${b.lon.toFixed(5)}`;
}

const cache = new Map<string, RouteLeg>();

export async function getRoadMatrix(points: Point[]): Promise<RoutingMatrix> {
  if (points.length < 2) {
    return { distancesKm: points.map(() => [0]), durationsMinutes: points.map(() => [0]), source: "empty" };
  }

  const base = process.env.ROUTING_URL?.replace(/\/$/, "") || "https://router.project-osrm.org";
  const coords = points.map(p => `${p.lon},${p.lat}`).join(";");
  const url = `${base}/table/v1/driving/${coords}?annotations=distance,duration`;

  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Routing provider HTTP ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data.distances) || !Array.isArray(data.durations)) {
    throw new Error("Routing provider ha restituito una matrice non valida");
  }

  const distancesKm = data.distances.map((row: number[]) => row.map(v => Number(v) / 1000));
  const durationsMinutes = data.durations.map((row: number[]) => row.map(v => Number(v) / 60));

  return { distancesKm, durationsMinutes, source: process.env.ROUTING_URL ? "configured-provider" : "osrm-demo" };
}

export function clearRoutingCache() {
  cache.clear();
}
