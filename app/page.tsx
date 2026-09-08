 "use client";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { optimize } from "../lib/optimizer";
import { Shipment, Vehicle, Coord, PlanResult } from "../lib/types";
import { getPlans, getVehicles, getDrivers } from "../lib/api";

const defaultVehicles:Vehicle[] = [
  {id:"V01",name:"Camion 01",maxWeight:5000,maxVolume:25,maxStops:30,available:true},
  {id:"V02",name:"Camion 02",maxWeight:5000,maxVolume:25,maxStops:30,available:true},
  {id:"V03",name:"Camion 03",maxWeight:7500,maxVolume:35,maxStops:35,available:true},
  {id:"V04",name:"Camion 04",maxWeight:12000,maxVolume:50,maxStops:40,available:true}
];

export default function Home(){
  const [depot,setDepot]=useState("Pescara, Italia");
  const [hubs,setHubs]=useState(["Chieti, Italia","Teramo, Italia","Lanciano, Italia"]);
  const [shipments,setShipments]=useState<Shipment[]>([]);
  const [result,setResult]=useState<PlanResult|null>(null);
  const [status,setStatus]=useState("Carica un Excel/CSV per iniziare.");
  const [factor,setFactor]=useState(1.25);
  const [maxDistance,setMaxDistance]=useState(300);
  const [minWeight,setMinWeight]=useState(0);
  const [companyId,setCompanyId]=useState("demo-company");
  const [driversCount,setDriversCount]=useState(0);
  const [plansCount,setPlansCount]=useState(0);
  const [dbMessage,setDbMessage]=useState("");

  async function loadManagementData(){
    try{
      const [vs,ds,ps]=await Promise.all([getVehicles(companyId),getDrivers(companyId),getPlans(companyId)]);
      setDriversCount(ds.drivers.length); setPlansCount(ps.plans.length);
      setDbMessage(`${vs.vehicles.length} mezzi · ${ds.drivers.length} autisti · ${ps.plans.length} piani salvati`);
    }catch(e:any){setDbMessage(`Database non collegato: ${e.message}`)}
  }

  function parseFile(file:File){
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const wb=XLSX.read(new Uint8Array(ev.target!.result as ArrayBuffer),{type:"array"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json<any>(ws,{defval:""});
        const out:Shipment[]=rows.map((r:any,i:number)=>{
          const keys=Object.keys(r);
          const pick=(patterns:string[])=>{
            const k=keys.find(x=>patterns.some(p=>x.toLowerCase().includes(p)));
            return k?String(r[k]).trim():"";
          };
          const num=(v:string)=>Number(String(v).replace(/\\./g,"").replace(",","."))||0;
          const address=pick(["indirizzo","address","via","strada","destinazione","recapito"]);
          const city=pick(["città","citta","comune","localita","località"]);
          const weight=num(pick(["peso","kg","quintal","lordo"]));
          const volume=num(pick(["volume","m3","m³","mc","cubatura"]));
          return {id:`S${i+1}`,address:[address,city].filter(Boolean).join(", "),recipient:pick(["destinatario","ragione sociale","cliente"]),ref:pick(["ddt","rif","bolla","spedizione","codice"]),weight,volume,priority:1,serviceMinutes:15};
        }).filter(s=>s.address);
        setShipments(out);
        setStatus(`${out.length} spedizioni importate. Geocodifica automatica ancora da collegare al provider aziendale.`);
        setResult(null);
      }catch(e:any){setStatus(`Errore importazione: ${e.message}`)}
    };
    reader.readAsArrayBuffer(file);
  }

  async function geocodeText(text:string):Promise<Coord|null>{
    try{
      const q=encodeURIComponent(text.includes("Italia")?text:`${text}, Italia`);
      const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&q=${q}`,{headers:{"Accept-Language":"it"}});
      const d=await r.json();
      return d?.[0]?{lat:Number(d[0].lat),lon:Number(d[0].lon),label:d[0].display_name}:null;
    }catch{return null}
  }

  async function plan(){
    if(!shipments.length){setStatus("Nessuna spedizione.");return}
    setStatus("Geocodifica e pianificazione in corso...");
    const depotCoord=await geocodeText(depot);
    if(!depotCoord){setStatus("Magazzino non localizzato.");return}
    const geocoded:Shipment[]=[];
    for(const s of shipments){
      const c=await geocodeText(s.address);
      geocoded.push({...s,coords:c});
    }
    const r=optimize({depot:depotCoord,shipments:geocoded,vehicles:defaultVehicles,maxDistance,roadFactor:factor,minWeight});
    setResult(r);
    setStatus(`Piano completato: ${r.routes.length} giri, ${r.unassigned.length} eccezioni.`);
  }

  const total=shipments.reduce((a,s)=>a+s.weight,0);
  return <main className="app">
    <header className="top"><div className="brand">OptiRoute <small>3.0</small></div><div className="muted" style={{color:"#c7d2fe"}}>Delivery Management & Route Optimization</div></header>
    <div className="shell">
      <aside className="side">
        <section className="section"><h2>Vincoli mezzi pesanti</h2>
          <div className="grid2">
            <div><label className="label">Altezza max (m)</label><input className="field" type="number" step="0.01" placeholder="4.00"/></div>
            <div><label className="label">Lunghezza max (m)</label><input className="field" type="number" step="0.1" placeholder="12.00"/></div>
            <div><label className="label">Peso totale max (kg)</label><input className="field" type="number" placeholder="44000"/></div>
            <div><label className="label">Restrizioni</label><input className="field" placeholder="ZTL, altezza, peso..." /></div>
          </div>
        </section>
        <section className="section"><h2>Gestionale</h2>
          <label className="label">ID azienda</label>
          <input className="field" value={companyId} onChange={e=>setCompanyId(e.target.value)}/>
          <div className="actions" style={{marginTop:8}}><button className="btn secondary" onClick={loadManagementData}>Sincronizza gestionale</button></div>
          <div className="status">{dbMessage||"Pronto per il collegamento PostgreSQL."}</div>
        </section>
        <section className="section"><h2>1. Magazzino</h2><label className="label">Indirizzo</label><input className="field" value={depot} onChange={e=>setDepot(e.target.value)}/></section>
        <section className="section"><h2>2. Punti fissi</h2>{hubs.map((h,i)=><div className="fixed" key={i}><input className="field" value={h} onChange={e=>setHubs(hubs.map((x,j)=>j===i?e.target.value:x))}/><button className="btn danger" onClick={()=>setHubs(hubs.filter((_,j)=>j!==i))}>×</button></div>)}<button className="btn secondary" onClick={()=>setHubs([...hubs,""])}>+ Aggiungi</button></section>
        <section className="section"><h2>3. Vincoli</h2><div className="grid2"><div><label className="label">Max km/giro</label><input className="field" type="number" value={maxDistance} onChange={e=>setMaxDistance(Number(e.target.value))}/></div><div><label className="label">Min kg</label><input className="field" type="number" value={minWeight} onChange={e=>setMinWeight(Number(e.target.value))}/></div><div><label className="label">Fattore fallback</label><input className="field" type="number" step=".05" value={factor} onChange={e=>setFactor(Number(e.target.value))}/></div></div><div className="warning">Il fattore è solo un fallback. Il passo successivo è sostituirlo con matrice stradale reale persistente.</div></section>
        <section className="section"><h2>4. Spedizioni</h2><label className="filebox">Carica Excel / CSV<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e=>e.target.files?.[0]&&parseFile(e.target.files[0])}/></label><p className="muted">{shipments.length} spedizioni · {Math.round(total).toLocaleString("it-IT")} kg</p><button className="btn primary" onClick={plan}>Pianifica OptiRoute 3.0</button><div className="status">{status}</div></section>
      </aside>
      <section className="main">
        <div className="kpis">
          <div className="kpi"><span>Spedizioni</span><b>{shipments.length}</b></div>
          <div className="kpi"><span>Giri</span><b>{result?.stats.vehicles||0}</b></div>
          <div className="kpi"><span>Tappe</span><b>{result?.stats.stops||0}</b></div>
          <div className="kpi"><span>Kg caricati</span><b>{Math.round(result?.stats.loadedKg||0).toLocaleString("it-IT")}</b></div>
          <div className="kpi"><span>Km stimati</span><b>{Math.round(result?.stats.totalKm||0)}</b></div>
          <div className="kpi"><span>Score piano</span><b>{result?.stats.planningScore||0}/100</b></div>
        </div>
        <div className="mapbox">Modulo mappa/routing reale — la 3.2 separa il motore dal database e prepara il routing stradale persistente.</div>
        <div className="content">
          <div className="panel"><h3>Giri generati</h3>{result?.routes.map((r,i)=><div className="route" key={r.id}><div className="routehead"><div><b>Giro {i+1} · {r.vehicleId}</b><div className="muted">{r.zone} · {r.shipments.length} tappe</div></div><b>{Math.round(r.totalWeight).toLocaleString("it-IT")} kg · {Math.round(r.totalDistance)} km</b></div><div className="stops">{r.shipments.map((s,j)=><div className="stop" key={s.id}><b>{j+1}</b><span>{s.recipient||s.ref||"Cliente"}<br/><span className="muted">{s.address}</span></span><b>{Math.round(s.weight)} kg</b></div>)}</div></div>)}{!result&&<p className="muted" style={{padding:12}}>Nessun piano ancora generato.</p>}</div>
          <div className="panel"><h3>Eccezioni</h3>{result?.unassigned.map(s=><div className="exception" key={s.id}><b>{s.recipient||s.ref||s.id}</b><br/>{s.address}<br/><b>{Math.round(s.weight)} kg</b></div>)}{result?.unassigned.length===0&&<p className="muted" style={{padding:12}}>Nessuna eccezione.</p>}{!result&&<p className="muted" style={{padding:12}}>Le eccezioni compariranno qui.</p>}</div>
        </div>
      </section>
    </div>
  </main>
}