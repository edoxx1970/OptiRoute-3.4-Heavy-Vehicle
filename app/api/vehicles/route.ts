import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
export async function GET(req:NextRequest){
  const companyId=req.nextUrl.searchParams.get("companyId");
  if(!companyId)return NextResponse.json({error:"companyId obbligatorio"},{status:400});
  return NextResponse.json({vehicles:await db.vehicle.findMany({where:{companyId,active:true},orderBy:{code:"asc"}})});
}
export async function POST(req:NextRequest){
  const b=await req.json();
  if(!b.companyId||!b.code||!b.name)return NextResponse.json({error:"companyId, code e name sono obbligatori"},{status:400});
  const vehicle=await db.vehicle.create({data:{companyId:b.companyId,code:b.code,name:b.name,maxWeightKg:Number(b.maxWeightKg??0),maxVolumeM3:Number(b.maxVolumeM3??0),maxStops:Number(b.maxStops??40)}});
  return NextResponse.json({vehicle},{status:201});
}
