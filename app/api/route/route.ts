import { NextRequest, NextResponse } from "next/server";

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const coords=(body.coords||[]) as {lat:number;lon:number}[];
    if(coords.length<2)return NextResponse.json({error:"Servono almeno due coordinate."},{status:400});
    const profile=body.profile||"driving";
    const list=coords.map(c=>`${c.lon},${c.lat}`).join(";");
    const url=`https://router.project-osrm.org/route/v1/${profile}/${list}?overview=false&steps=false`;
    const r=await fetch(url,{headers:{"User-Agent":"OptiRoute/3.0"}});
    if(!r.ok)throw new Error(`Routing HTTP ${r.status}`);
    const data=await r.json();
    if(data.code!=="Ok"||!data.routes?.length)throw new Error("Percorso non disponibile");
    return NextResponse.json({
      distanceKm:data.routes[0].distance/1000,
      durationMinutes:data.routes[0].duration/60,
      provider:"OSRM"
    });
  }catch(e:any){
    return NextResponse.json({error:e?.message||"Errore routing"},{status:502});
  }
}