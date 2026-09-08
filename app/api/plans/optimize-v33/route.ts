import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { getRoadMatrix } from "../../../../lib/routing";
import { optimizeV33 } from "../../../../lib/optimizer-v33";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.companyId || !body.planDate || body.depot?.lat == null || body.depot?.lon == null) {
      return NextResponse.json({ error: "companyId, planDate e coordinate del deposito sono obbligatori" }, { status: 400 });
    }

    const dbShipments = body.shipments?.length
      ? body.shipments
      : await db.shipment.findMany({ where: { companyId: body.companyId, planningStatus: { in: ["unplanned","exception"] } } });

    const dbVehicles = await db.vehicle.findMany({ where: { companyId: body.companyId, active: true }, orderBy: { code: "asc" } });

    const shipments = dbShipments.map((s:any, i:number)=>({
      id:String(s.id ?? `S${i+1}`),
      address:String(s.address ?? ""),
      recipient:s.recipient ?? undefined,
      ref:s.externalRef ?? undefined,
      weight:Number(s.weight ?? s.weightKg ?? 0),
      volume:Number(s.volume ?? s.volumeM3 ?? 0),
      priority:Number(s.priority ?? 1),
      serviceMinutes:Number(s.serviceMinutes ?? 15),
      timeWindowStart:s.timeWindowStart ?? s.windowStart ?? undefined,
      timeWindowEnd:s.timeWindowEnd ?? s.windowEnd ?? undefined,
      coords:s.coords ?? (s.latitude!=null&&s.longitude!=null ? {lat:Number(s.latitude),lon:Number(s.longitude)} : null)
    }));

    const vehicles=(body.vehicles?.length ? body.vehicles : dbVehicles).map((v:any)=>({
      id:String(v.id ?? v.code), name:String(v.name ?? v.code),
      maxWeight:Number(v.maxWeight ?? v.maxWeightKg ?? 0),
      maxVolume:Number(v.maxVolume ?? v.maxVolumeM3 ?? 0),
      maxStops:Number(v.maxStops ?? 40), available:v.available!==false
    }));

    const missing=shipments.filter((s:any)=>!s.coords);
    if(missing.length) {
      return NextResponse.json({
        error:"Alcune spedizioni non sono geocodificate",
        missing:missing.map((s:any)=>({id:s.id,address:s.address}))
      },{status:422});
    }

    const points=[body.depot,...shipments.map((s:any)=>s.coords)];
    const matrix=await getRoadMatrix(points);
    const result=optimizeV33({
      depot:body.depot, shipments, vehicles, matrix,
      maxDistance:Number(body.maxDistance ?? 500)
    });

    const plan=await db.$transaction(async tx=>{
      const created=await tx.plan.create({data:{
        companyId:body.companyId, planDate:new Date(body.planDate), status:"planned",
        depotName:body.depotName??null, depotLat:Number(body.depot.lat), depotLon:Number(body.depot.lon),
        totalKm:result.stats.totalKm,totalStops:result.stats.stops,totalWeight:result.stats.loadedKg
      }});

      for(const [idx,r] of result.routes.entries()){
        const route=await tx.route.create({data:{
          planId:created.id, vehicleId:dbVehicles.some(v=>v.id===r.vehicleId)?r.vehicleId:null,
          sequence:idx+1, zone:r.zone,status:"planned",totalKm:r.totalDistance,
          estimatedMinutes:r.estimatedMinutes,totalWeight:r.totalWeight,totalVolume:r.totalVolume
        }});
        await tx.routeStop.createMany({data:r.shipments.map((s:any,j:number)=>({routeId:route.id,shipmentId:s.id,stopOrder:j+1}))});
        if(r.shipments.length) await tx.shipment.updateMany({
          where:{companyId:body.companyId,id:{in:r.shipments.map((s:any)=>s.id)}},
          data:{planningStatus:"planned"}
        });
      }
      if(result.unassigned.length) await tx.shipment.updateMany({
        where:{companyId:body.companyId,id:{in:result.unassigned.map((s:any)=>s.id)}},
        data:{planningStatus:"exception",exceptionReason:"Vincoli di mezzo/finestra/distanza"}
      });
      return created;
    });

    return NextResponse.json({plan,result,routing:{source:matrix.source,points:points.length}});
  } catch(e:any) {
    return NextResponse.json({error:e?.message??"Errore routing/pianificazione"},{status:500});
  }
}
