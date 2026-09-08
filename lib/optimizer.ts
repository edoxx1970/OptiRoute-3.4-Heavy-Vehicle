import { Shipment, Route, Vehicle, Coord, PlanResult } from "./types";

export function haversineKm(a:Coord,b:Coord){
  const R=6371, p=Math.PI/180;
  const dLat=(b.lat-a.lat)*p, dLon=(b.lon-a.lon)*p;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function routeDistance(seq:Shipment[], depot:Coord, factor:number){
  if(!seq.length) return 0;
  let d=haversineKm(depot,seq[0].coords!);
  for(let i=1;i<seq.length;i++) d+=haversineKm(seq[i-1].coords!,seq[i].coords!);
  d+=haversineKm(seq[seq.length-1].coords!,depot);
  return d*factor;
}

function nearestOrder(items:Shipment[], depot:Coord){
  const rest=[...items], out:Shipment[]=[]; let pos=depot;
  while(rest.length){
    let bi=0,bd=Infinity;
    for(let i=0;i<rest.length;i++){const d=haversineKm(pos,rest[i].coords!);if(d<bd){bd=d;bi=i}}
    out.push(rest.splice(bi,1)[0]); pos=out[out.length-1].coords!;
  }
  return out;
}

function twoOpt(seq:Shipment[], depot:Coord, factor:number){
  if(seq.length<4)return seq;
  let best=[...seq], bestD=routeDistance(best,depot,factor), improved=true, guard=0;
  while(improved && guard++<25){
    improved=false;
    for(let i=0;i<best.length-1;i++) for(let k=i+1;k<best.length;k++){
      const cand=best.slice(0,i).concat(best.slice(i,k+1).reverse(),best.slice(k+1));
      const d=routeDistance(cand,depot,factor);
      if(d<bestD-0.001){best=cand;bestD=d;improved=true}
    }
  }
  return best;
}

function routeVolume(s:Shipment[]){return s.reduce((a,x)=>a+(x.volume||0),0)}
function routeWeight(s:Shipment[]){return s.reduce((a,x)=>a+x.weight,0)}

export function optimize(input:{
  depot:Coord; shipments:Shipment[]; vehicles:Vehicle[];
  maxDistance:number; roadFactor:number; minWeight:number;
}):PlanResult{
  const unassigned:Shipment[]=[];
  const valid=input.shipments.filter(s=>{
    if(!s.coords){unassigned.push(s);return false}
    if(!(s.weight>0)){unassigned.push(s);return false}
    return true;
  });
  const sorted=[...valid].sort((a,b)=>(b.priority||0)-(a.priority||0)||b.weight-a.weight);
  const routes:Route[]=[];
  const remaining=[...sorted];

  for(const v of input.vehicles.filter(x=>x.available)){
    if(!remaining.length)break;
    const chosen:Shipment[]=[]; let kg=0, vol=0;
    // Greedy by priority first, then best geographic fit.
    for(let i=0;i<remaining.length;){
      const s=remaining[i];
      if(kg+s.weight<=v.maxWeight && vol+(s.volume||0)<=v.maxVolume && chosen.length<v.maxStops){
        chosen.push(s);kg+=s.weight;vol+=s.volume||0;remaining.splice(i,1);
      }else i++;
    }
    if(!chosen.length)continue;
    let seq=twoOpt(nearestOrder(chosen,input.depot),input.depot,input.roadFactor);
    while(seq.length>1 && routeDistance(seq,input.depot,input.roadFactor)>input.maxDistance){
      // Remove the stop whose removal reduces the most distance.
      let worst=0,gain=-Infinity;
      const before=routeDistance(seq,input.depot,input.roadFactor);
      for(let i=0;i<seq.length;i++){
        const c=seq.slice(0,i).concat(seq.slice(i+1));
        const g=before-routeDistance(c,input.depot,input.roadFactor);
        if(g>gain){gain=g;worst=i}
      }
      remaining.push(seq[worst]); seq=twoOpt(seq.slice(0,worst).concat(seq.slice(worst+1)),input.depot,input.roadFactor);
    }
    const km=routeDistance(seq,input.depot,input.roadFactor);
    if(seq.length && km<=input.maxDistance){
      routes.push({
        id:v.id,vehicleId:v.id,zone:[...new Set(seq.map(s=>s.zone||"Generale"))].join(" + "),
        shipments:seq,totalWeight:routeWeight(seq),totalVolume:routeVolume(seq),
        totalDistance:km,estimatedMinutes:Math.round(km/45*60+seq.reduce((a,s)=>a+(s.serviceMinutes||15),0)),
        fill:routeWeight(seq)/v.maxWeight
      });
    }
  }

  for(const s of remaining) unassigned.push(s);
  // One-pass cross-route improvement: swap stops when total distance decreases
  let changed=true, loops=0;
  while(changed && loops++<4){
    changed=false;
    for(let a=0;a<routes.length;a++) for(let b=a+1;b<routes.length;b++){
      const A=routes[a],B=routes[b];
      for(let i=0;i<A.shipments.length;i++) for(let j=0;j<B.shipments.length;j++){
        const x=A.shipments[i],y=B.shipments[j];
        const A2=A.shipments.slice(); const B2=B.shipments.slice();
        A2[i]=y;B2[j]=x;
        const va=input.vehicles.find(v=>v.id===A.vehicleId)!, vb=input.vehicles.find(v=>v.id===B.vehicleId)!;
        if(routeWeight(A2)>va.maxWeight||routeWeight(B2)>vb.maxWeight)continue;
        if(routeVolume(A2)>va.maxVolume||routeVolume(B2)>vb.maxVolume)continue;
        const old=A.totalDistance+B.totalDistance;
        const ndA=routeDistance(twoOpt(A2,input.depot,input.roadFactor),input.depot,input.roadFactor);
        const ndB=routeDistance(twoOpt(B2,input.depot,input.roadFactor),input.depot,input.roadFactor);
        if(ndA+ndB<old-0.5){
          A.shipments=A2;B.shipments=B2;A.totalDistance=ndA;B.totalDistance=ndB;
          A.totalWeight=routeWeight(A2);B.totalWeight=routeWeight(B2);
          A.totalVolume=routeVolume(A2);B.totalVolume=routeVolume(B2);
          A.fill=A.totalWeight/va.maxWeight;B.fill=B.totalWeight/vb.maxWeight;
          changed=true;
        }
      }
    }
  }

  const loadedKg=routes.reduce((a,r)=>a+r.totalWeight,0);
  const totalKm=routes.reduce((a,r)=>a+r.totalDistance,0);
  const stops=routes.reduce((a,r)=>a+r.shipments.length,0);
  const avgFill=routes.length?routes.reduce((a,r)=>a+r.fill,0)/routes.length:0;
  const planningScore=Math.max(0,Math.round(100-(unassigned.length/(input.shipments.length||1))*60-(totalKm/Math.max(1,stops))*0.15));

  return {routes,unassigned,stats:{
    vehicles:routes.length,stops,loadedKg,stoppedKg:unassigned.reduce((a,s)=>a+s.weight,0),
    totalKm,avgFill,planningScore
  }};
}