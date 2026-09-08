export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export const getShipments = (companyId: string) =>
  api<{ shipments: any[] }>(`/api/shipments?companyId=${encodeURIComponent(companyId)}`);

export const getVehicles = (companyId: string) =>
  api<{ vehicles: any[] }>(`/api/vehicles?companyId=${encodeURIComponent(companyId)}`);

export const getDrivers = (companyId: string) =>
  api<{ drivers: any[] }>(`/api/drivers?companyId=${encodeURIComponent(companyId)}`);

export const getPlans = (companyId: string) =>
  api<{ plans: any[] }>(`/api/plans?companyId=${encodeURIComponent(companyId)}`);
