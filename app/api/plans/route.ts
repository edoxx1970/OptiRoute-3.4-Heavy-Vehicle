import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
export async function GET(req:NextRequest){
  const companyId=req.nextUrl.searchParams.get("companyId");
  if(!companyId)return NextResponse.json({error:"companyId obbligatorio"},{status:400});
  const plans=await db.plan.findMany({
    where:{companyId},
    include:{routes:{include:{vehicle:true,driver:true,stops:{include:{shipment:true},orderBy:{stopOrder:"asc"}}}}},
    orderBy:{planDate:"desc"}
  });
  return NextResponse.json({plans});
}
export async function POST(req:NextRequest){
  const b=await req.json();
  if(!b.companyId||!b.planDate)return NextResponse.json({error:"companyId e planDate sono obbligatori"},{status:400});
  const plan=await db.plan.create({data:{companyId:b.companyId,planDate:new Date(b.planDate),status:"draft"}});
  return NextResponse.json({plan},{status:201});
}
