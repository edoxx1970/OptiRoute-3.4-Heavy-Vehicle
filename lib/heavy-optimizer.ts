import type { Shipment, Vehicle, Coord } from "./types";

type Driver = { id:string; name:string; shiftStart?:string; shiftEnd?:string; breakMinutes?:number };
type Matrix = { distancesKm:number[][]; durationsMinutes:number[][] };

function parseTime(v?:string){
  if(!v) return undefined;
  const m=v.match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1])*60+Number(m[2]) : undefined;
}
function geo(a:Coord,b:Coord){
  const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lon-a.lon)*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}
function truckCompatible(s:any,v:any){
  const r=s.requiredRestrictions ?? [];
  const forbidden=v.restrictions ?? [];
  return r.every((x:string)=>!forbidden.includes(x));
}
export function optimizeHeavy(input:{
  depot:Coord; shipments:any[]; vehicles:any[]; drivers:Driver[]; matrix?:Matrix;
  maxDistance?:number;
}){
  const ss=input.shipments.filter(s=>s.coords);
  const points=[input.depot,...ss.map(s=>s.coords)];
  const dist=(a:number,b:number)=>input.matrix?.distancesKm[a][b] ?? geo(points[a],points[b])*1.25;
  const dur=(a:number,b:number)=>input.matrix?.durationsMinutes[a][b] ?? dist(a,b)/45*60;

  const available=input.vehicles.filter(v=>v.available!==false);
  const remaining=new Set(ss.map(s=>s.id));
  const routes:any[]=[];
  const exceptions:any[]=[];

  for(const v of available){
    if(!remaining.size) break;
    const driver=input.drivers.find(d=>!routes.some(r=>r.driverId===d.id));
    let cur=0, km=0, minutes=0, weight=0, volume=0;
    const selected:any[]=[];
    const shiftStart=parseTime(driver?.shiftStart) ?? 0;
    const shiftEnd=parseTime(driver?.shiftEnd) ?? 1440;
    minutes=shiftStart;

    while(remaining.size && selected.length < (v.maxStops ?? 40)){
      const candidates=ss.filter(s=>remaining.has(s.id)).map(s=>{
        const idx=ss.indexOf(s)+1, leg=dur(cur,idx), d=dist(cur,idx);
        const ws=parseTime(s.timeWindowStart??s.windowStart), we=parseTime(s.timeWindowEnd??s.windowEnd);
        const arrival=minutes+leg;
        const wait=ws!==undefined && arrival<ws ? ws-arrival : 0;
        const finish=arrival+wait+(s.serviceMinutes??15);
        const back=dist(idx,0);
        const feasible =
          weight+(s.weight??0) <= (v.maxWeight ?? v.maxWeightKg ?? Infinity) &&
          volume+(s.volume??0) <= (v.maxVolume ?? v.maxVolumeM3 ?? Infinity) &&
          km+d+back <= (input.maxDistance ?? Infinity) &&
          finish+dur(idx,0) <= shiftEnd &&
          (we===undefined || finish<=we) &&
          truckCompatible(s,v);
        const urgency=ws===undefined ? 0 : Math.max(0,720-ws);
        return {s,idx,d,leg,wait,finish,feasible,score:d+wait*0.05-urgency*0.002};
      }).filter(x=>x.feasible).sort((a,b)=>a.score-b.score);

      if(!candidates.length) break;
      const c=candidates[0];
      selected.push(c.s); remaining.delete(c.s.id);
      cur=c.idx; km+=c.d; minutes=c.finish;
      weight+=(c.s.weight??0); volume+=(c.s.volume??0);
    }

    if(selected.length){
      km+=dist(cur,0); minutes+=dur(cur,0);
      routes.push({
        vehicleId:v.id,driverId:driver?.id??null,vehicle:v,driver,
        shipments:selected,totalDistance:km,estimatedMinutes:Math.round(minutes-shiftStart),
        totalWeight:weight,totalVolume:volume,zone:""
      });
    }
  }

  ss.filter(s=>remaining.has(s.id)).forEach(s=>exceptions.push({
    shipmentId:s.id,
    reason:"Nessun mezzo/autista compatibile con capacità, turno, distanza, finestra o restrizioni"
  }));

  return {
    routes, exceptions,
    stats:{
      totalKm:routes.reduce((a,r)=>a+r.totalDistance,0),
      stops:routes.reduce((a,r)=>a+r.shipments.length,0),
      loadedKg:routes.reduce((a,r)=>a+r.totalWeight,0),
      unassigned:exceptions.length
    }
  };
}
