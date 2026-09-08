import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { getRoadMatrix } from "../../../../lib/routing";
import { optimizeHeavy } from "../../../../lib/heavy-optimizer";

export async function POST(req:NextRequest){
  try{
    const b=await req.json();
    if(!b.companyId||!b.planDate||b.depot?.lat==null||b.depot?.lon==null)
      return NextResponse.json({error:"companyId, planDate e deposito sono obbligatori"},{status:400});

    const shipments=b.shipments?.length ? b.shipments :
      await db.shipment.findMany({where:{companyId:b.companyId,planningStatus:{in:["unplanned","exception"]}}});
    const vehicles=await db.vehicle.findMany({where:{companyId:b.companyId,active:true},orderBy:{code:"asc"}});
    const drivers=await db.driver.findMany({where:{companyId:b.companyId,active:true},orderBy:{name:"asc"}});

    const normalized=shipments.map((s:any)=>({
      ...s,id:String(s.id),weight:Number(s.weight??s.weightKg??0),
      volume:Number(s.volume??s.volumeM3??0),serviceMinutes:Number(s.serviceMinutes??15),
      timeWindowStart:s.timeWindowStart??s.windowStart,timeWindowEnd:s.timeWindowEnd??s.windowEnd,
      coords:s.coords??(s.latitude!=null&&s.longitude!=null?{lat:Number(s.latitude),lon:Number(s.longitude)}:null)
    }));
    const missing=normalized.filter((s:any)=>!s.coords);
    if(missing.length) return NextResponse.json({error:"Spedizioni non geocodificate",missing:missing.map((s:any)=>s.id)},{status:422});

    const matrix=await getRoadMatrix([b.depot,...normalized.map((s:any)=>s.coords)]);
    const result=optimizeHeavy({depot:b.depot,shipments:normalized,vehicles,drivers,matrix,maxDistance:Number(b.maxDistance??500)});

    const plan=await db.$transaction(async tx=>{
      const created=await tx.plan.create({data:{
        companyId:b.companyId,planDate:new Date(b.planDate),status:"planned",
        depotName:b.depotName??null,depotLat:Number(b.depot.lat),depotLon:Number(b.depot.lon),
        startTime:b.startTime??null,endTime:b.endTime??null,
        totalKm:result.stats.totalKm,totalStops:result.stats.stops,totalWeight:result.stats.loadedKg
      }});
      for(const [i,r] of result.routes.entries()){
        const route=await tx.route.create({data:{
          planId:created.id,vehicleId:vehicles.some(v=>v.id===r.vehicleId)?r.vehicleId:null,
          driverId:drivers.some(d=>d.id===r.driverId)?r.driverId:null,sequence:i+1,zone:r.zone,
          status:"planned",totalKm:r.totalDistance,estimatedMinutes:r.estimatedMinutes,
          totalWeight:r.totalWeight,totalVolume:r.totalVolume
        }});
        await tx.routeStop.createMany({data:r.shipments.map((s:any,j:number)=>({routeId:route.id,shipmentId:s.id,stopOrder:j+1}))});
        await tx.shipment.updateMany({where:{companyId:b.companyId,id:{in:r.shipments.map((s:any)=>s.id)}},data:{planningStatus:"planned"}});
      }
      if(result.exceptions.length){
        await tx.shipment.updateMany({where:{companyId:b.companyId,id:{in:result.exceptions.map(x=>x.shipmentId)}},
          data:{planningStatus:"exception",exceptionReason:"Nessun mezzo/autista compatibile con i vincoli"}});
      }
      return created;
    });
    return NextResponse.json({plan,result,routing:{source:matrix.source}});
  }catch(e:any){
    return NextResponse.json({error:e?.message??"Errore pianificazione mezzi pesanti"},{status:500});
  }
}
