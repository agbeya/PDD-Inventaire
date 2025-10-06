
export type Year = { id:string; label:string; startDate?:any; endDate?:any };
export type Zone = { id:string; name:string; };
export type Subzone = { id:string; name:string; zoneId:string };
export type Service = { id:string; name:string; active:boolean };

export type Activity = {
  id:string;
  label:string;
  startDate:any; 
  endDate:any;
  yearId:string; 
  subzoneId:string;
  itemsTotal:number; 
  itemsReturned:number; 
  isComplete:boolean;
  observations?: string;
};

export type Item = {
  id:string;
  name:string;
  qty:number;
  sortieChecked:boolean;
  sortieAt:any|null;
  sortieByUid?: string|null;
  sortieByName?: string|null;
  retourChecked:boolean;
  retourAt:any|null;
  retourByUid?: string|null;
  retourByName?: string|null;
  createdAt:any;
  updatedAt:any;
};

