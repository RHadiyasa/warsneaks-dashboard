export type JobStatus = "queued"|"running"|"succeeded"|"partial"|"failed"|"cancelled";
export type DataState = "ready"|"empty"|"error"|"stale";
export interface JobRecord { id:string; type:string; status:JobStatus; attempts:number; createdAt:string; startedAt?:string; finishedAt?:string; summary?:string }
export interface DashboardSummary { state:DataState; generatedAt:string; freshness:{source:string;lastSyncedAt:string;status:"healthy"|"stale"|"error"}[]; metrics:{label:string;value:string;note:string}[]; jobs:JobRecord[] }
