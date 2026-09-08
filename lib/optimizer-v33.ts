import type { Shipment, Vehicle, Coord } from "./types";

type Matrix = { distancesKm: number[][]; durationsMinutes: number[][] };
type Input = {
  depot: Coord;
  shipments: Shipment[];
  vehicles: Vehicle[];
  matrix?: Matrix;
  maxDistance?: number;
  roadFactor?: number;
  minWeight?: number;
};

function geo(a: Coord, b: Coord) {
  const R=6371, dLat=(b.lat-a.lat)*Math.PI/180, dLon=(b.lon-a.lon)*Math.PI/180;
  const x=Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}

function windowMinutes(s: Shipment) {
  const parse=(x?:string)=> {
    if(!x) return undefined;
    const m=x.match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1])*60+Number(m[2]) : undefined;
  };
  return { start: parse(s.timeWindowStart), end: parse(s.timeWindowEnd) };
}

export function optimizeV33(input: Input) {
  const shipments = input.shipments.filter(s=>s.coords);
  const vehicles = input.vehicles.filter(v=>v.available);
  const points=[input.depot,...shipments.map(s=>s.coords!)];

  const d=(a:number,b:number)=>{
    if(input.matrix) return input.matrix.distancesKm[a][b];
    return geo(points[a],points[b])*(input.roadFactor ?? 1.25);
  };
  const t=(a:number,b:number)=>{
    if(input.matrix) return input.matrix.durationsMinutes[a][b];
    return d(a,b)/45*60;
  };

  const remaining=new Set(shipments.map(s=>s.id));
  const routes:any[]=[]; const unassigned:any[]=[];

  // Build routes one vehicle at a time, choosing feasible next stops by
  // time-window urgency, then incremental road distance.
  vehicles.forEach((v, vehicleIndex)=>{
    if(!remaining.size) return;
    let current=0, km=0, mins=0, weight=0, volume=0;
    const selected:any[]=[];

    while(remaining.size) {
      const candidates=shipments.filter(s=>remaining.has(s.id)).map(s=>{
        const i=shipments.indexOf(s)+1;
        const leg=t(current,i), dist=d(current,i);
        const win=windowMinutes(s);
        const arrival=mins+leg;
        const wait=win.start!==undefined && arrival<win.start ? win.start-arrival : 0;
        const finish=arrival+wait+s.serviceMinutes;
        const back=d(i,0);
        const feasibleWeight=weight+s.weight <= v.maxWeight;
        const feasibleVolume=volume+(s.volume??0) <= v.maxVolume;
        const feasibleStops=selected.length < v.maxStops;
        const feasibleDistance=km+dist+back <= (input.maxDistance ?? Infinity);
        const feasibleWindow=win.end===undefined || finish <= win.end;
        const urgency=win.start!==undefined ? Math.max(0, 720-win.start) : 0;
        return {s,i,leg,dist,wait,finish,win,score:dist+wait*0.08-urgency*0.001,feasible:feasibleWeight&&feasibleVolume&&feasibleStops&&feasibleDistance&&feasibleWindow};
      }).filter(x=>x.feasible).sort((a,b)=>a.score-b.score);

      if(!candidates.length) break;
      const c=candidates[0];
      const arrival=mins+c.leg+c.wait;
      selected.push(c.s);
      remaining.delete(c.s.id);
      current=c.i;
      km+=c.dist;
      mins=arrival+c.s.serviceMinutes;
      weight+=c.s.weight;
      volume+=c.s.volume??0;
    }

    if(selected.length){
      km+=d(current,0); mins+=t(current,0);
      routes.push({
        vehicleId:v.id, vehicle:v, shipments:selected,
        totalDistance:km, estimatedMinutes:Math.round(mins),
        totalWeight:weight, totalVolume:volume,
        zone:""
      });
    }
  });

  shipments.filter(s=>remaining.has(s.id)).forEach(s=>unassigned.push(s));

  return {
    routes,
    unassigned,
    stats:{
      totalKm: routes.reduce((a,r)=>a+r.totalDistance,0),
      stops: routes.reduce((a,r)=>a+r.shipments.length,0),
      loadedKg: routes.reduce((a,r)=>a+r.totalWeight,0),
      unassigned: unassigned.length
    }
  };
}
