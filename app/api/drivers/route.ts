import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
export async function GET(req:NextRequest){
  const companyId=req.nextUrl.searchParams.get("companyId");
  if(!companyId)return NextResponse.json({error:"companyId obbligatorio"},{status:400});
  return NextResponse.json({drivers:await db.driver.findMany({where:{companyId,active:true},orderBy:{name:"asc"}})});
}
export async function POST(req:NextRequest){
  const b=await req.json();
  if(!b.companyId||!b.name)return NextResponse.json({error:"companyId e name sono obbligatori"},{status:400});
  const driver=await db.driver.create({data:{companyId:b.companyId,name:b.name,phone:b.phone??null}});
  return NextResponse.json({driver},{status:201});
}
