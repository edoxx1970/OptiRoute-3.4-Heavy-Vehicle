export type Coord = { lat:number; lon:number; label?:string };

export type Shipment = {
  id:string; address:string; recipient?:string; ref?:string;
  weight:number; weightReal?:number; volume?:number;
  priority?:number; serviceMinutes?:number;
  timeWindowStart?:string; timeWindowEnd?:string;
  coords?:Coord|null; zone?:string;
};

export type Vehicle = {
  id:string; name:string; maxWeight:number; maxVolume:number;
  maxStops:number; available:boolean;
};

export type Route = {
  id:string; vehicleId?:string; zone:string; shipments:Shipment[];
  totalWeight:number; totalVolume:number; totalDistance:number;
  estimatedMinutes:number; fill:number;
};

export type PlanResult = {
  routes:Route[]; unassigned:Shipment[]; stats:{
    vehicles:number; stops:number; loadedKg:number; stoppedKg:number;
    totalKm:number; avgFill:number; planningScore:number;
  };
};