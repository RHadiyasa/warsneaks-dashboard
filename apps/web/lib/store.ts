import { randomUUID } from "node:crypto"; import { demoSummary,transitionJob } from "@warsneaks/domain"; import type { JobRecord } from "@warsneaks/shared";
const state=globalThis as unknown as {phase1Jobs?:Map<string,JobRecord>};const jobs=state.phase1Jobs??new Map<string,JobRecord>();state.phase1Jobs=jobs;
export function enqueueSample(){let job:JobRecord={id:randomUUID(),type:"sample.health-check",status:"queued",attempts:0,createdAt:new Date().toISOString()};job=transitionJob(job,"running");job=transitionJob(job,"succeeded");job.summary="Worker contract verified: 1 record processed";jobs.set(job.id,job);return job}
export const findJob=(id:string)=>jobs.get(id);export const summary=()=>demoSummary([...jobs.values()].slice(-5).reverse());
