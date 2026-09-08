import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";

const allowed = new Set(["pending", "en_route", "arrived", "delivered", "failed"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { routeId: string; stopId: string } }
) {
  const body = await req.json();
  if (!allowed.has(body.status)) {
    return NextResponse.json({ error: "Stato consegna non valido" }, { status: 400 });
  }

  const stop = await db.routeStop.findFirst({
    where: { id: params.stopId, routeId: params.routeId }
  });
  if (!stop) return NextResponse.json({ error: "Fermata non trovata" }, { status: 404 });

  const updated = await db.$transaction(async tx => {
    const s = await tx.routeStop.update({
      where: { id: stop.id },
      data: {
        deliveryStatus: body.status,
        arrivalTime: body.status === "arrived" || body.status === "delivered" ? new Date() : stop.arrivalTime,
        failureReason: body.status === "failed" ? (body.reason ?? "Consegna fallita") : null
      }
    });

    await tx.shipment.update({
      where: { id: stop.shipmentId },
      data: {
        deliveryStatus: body.status === "delivered" ? "delivered" :
          body.status === "failed" ? "failed" : body.status
      }
    });

    return s;
  });

  return NextResponse.json({ stop: updated });
}
