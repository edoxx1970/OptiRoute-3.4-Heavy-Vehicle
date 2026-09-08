import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { optimize } from "../../../../lib/optimizer";
import { Shipment, Vehicle } from "../../../../lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.companyId || !body.planDate || !body.depot?.lat || !body.depot?.lon) {
      return NextResponse.json({ error: "companyId, planDate e depot con coordinate sono obbligatori" }, { status: 400 });
    }

    const dbVehicles = await db.vehicle.findMany({
      where: { companyId: body.companyId, active: true },
      orderBy: { code: "asc" }
    });

    const vehicles: Vehicle[] = (body.vehicles?.length ? body.vehicles : dbVehicles).map((v: any) => ({
      id: String(v.id ?? v.code),
      name: String(v.name ?? v.code),
      maxWeight: Number(v.maxWeight ?? v.maxWeightKg ?? 0),
      maxVolume: Number(v.maxVolume ?? v.maxVolumeM3 ?? 0),
      maxStops: Number(v.maxStops ?? 40),
      available: v.available !== false
    }));

    const shipments: Shipment[] = (body.shipments ?? []).map((s: any, i: number) => ({
      id: String(s.id ?? `S${i + 1}`),
      address: String(s.address ?? ""),
      recipient: s.recipient ?? undefined,
      ref: s.externalRef ?? s.ref ?? undefined,
      weight: Number(s.weight ?? s.weightKg ?? 0),
      volume: s.volume == null && s.volumeM3 == null ? 0 : Number(s.volume ?? s.volumeM3),
      priority: Number(s.priority ?? 1),
      serviceMinutes: Number(s.serviceMinutes ?? 15),
      timeWindowStart: s.timeWindowStart ?? s.windowStart ?? undefined,
      timeWindowEnd: s.timeWindowEnd ?? s.windowEnd ?? undefined,
      coords: s.coords ?? (s.latitude != null && s.longitude != null ? { lat: Number(s.latitude), lon: Number(s.longitude) } : null)
    }));

    const result = optimize({
      depot: body.depot,
      shipments,
      vehicles,
      maxDistance: Number(body.maxDistance ?? 300),
      roadFactor: Number(body.roadFactor ?? 1.25),
      minWeight: Number(body.minWeight ?? 0)
    });

    const plan = await db.$transaction(async (tx) => {
      const created = await tx.plan.create({
        data: {
          companyId: body.companyId,
          planDate: new Date(body.planDate),
          status: "planned",
          depotName: body.depotName ?? null,
          depotLat: Number(body.depot.lat),
          depotLon: Number(body.depot.lon),
          totalKm: result.stats.totalKm,
          totalStops: result.stats.stops,
          totalWeight: result.stats.loadedKg
        }
      });

      for (const [idx, r] of result.routes.entries()) {
        const route = await tx.route.create({
          data: {
            planId: created.id,
            vehicleId: dbVehicles.some(v => v.id === r.vehicleId) ? r.vehicleId : null,
            sequence: idx + 1,
            zone: r.zone,
            status: "planned",
            totalKm: r.totalDistance,
            estimatedMinutes: r.estimatedMinutes,
            totalWeight: r.totalWeight,
            totalVolume: r.totalVolume
          }
        });

        await tx.routeStop.createMany({
          data: r.shipments.map((s, stopIndex) => ({
            routeId: route.id,
            shipmentId: s.id,
            stopOrder: stopIndex + 1
          }))
        });

        await tx.shipment.updateMany({
          where: { id: { in: r.shipments.map(s => s.id) }, companyId: body.companyId },
          data: { planningStatus: "planned" }
        });
      }

      if (result.unassigned.length) {
        await tx.shipment.updateMany({
          where: { id: { in: result.unassigned.map(s => s.id) }, companyId: body.companyId },
          data: { planningStatus: "exception", exceptionReason: "Non assegnata dal motore di pianificazione" }
        });
      }

      return created;
    });

    return NextResponse.json({ plan, result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Errore durante la pianificazione" }, { status: 500 });
  }
}
