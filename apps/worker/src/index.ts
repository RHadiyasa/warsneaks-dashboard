import { transitionJob } from "@warsneaks/domain"; import type { JobRecord } from "@warsneaks/shared";
const queued:JobRecord={id:"worker-smoke",type:"sample.health-check",status:"queued",attempts:0,createdAt:new Date().toISOString()};const done=transitionJob(transitionJob(queued,"running"),"succeeded");console.log(JSON.stringify({service:"warsneaks-worker",job:done},null,2));
