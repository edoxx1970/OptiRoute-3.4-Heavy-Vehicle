import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";

export async function GET(req:NextRequest){
  const companyId=req.nextUrl.searchParams.get("companyId");
  if(!companyId)return NextResponse.json({error:"companyId obbligatorio"},{status:400});
  const shipments=await db.shipment.findMany({where:{companyId},orderBy:{createdAt:"desc"}});
  return NextResponse.json({shipments});
}
export async function POST(req:NextRequest){
  const b=await req.json();
  if(!b.companyId||!b.address)return NextResponse.json({error:"companyId e address sono obbligatori"},{status:400});
  const shipment=await db.shipment.create({data:{
    companyId:b.companyId,address:b.address,recipient:b.recipient??null,
    externalRef:b.externalRef??null,city:b.city??null,postalCode:b.postalCode??null,
    weightKg:Number(b.weightKg??0),volumeM3:b.volumeM3==null?null:Number(b.volumeM3),
    pallets:b.pallets==null?null:Number(b.pallets),parcels:b.parcels==null?null:Number(b.parcels),
    priority:Number(b.priority??1),serviceMinutes:Number(b.serviceMinutes??15),
    windowStart:b.windowStart??null,windowEnd:b.windowEnd??null
  }});
  return NextResponse.json({shipment},{status:201});
}
