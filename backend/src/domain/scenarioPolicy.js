const crypto = require('crypto');
function fail(condition, message, code='INVALID_SCENARIO') { if(condition){const e=new Error(message);e.code=code;throw e;} }
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function validateRun(input){
  fail(!input||typeof input!=='object','run specification required');
  fail(!Number.isInteger(input.seed)||input.seed<0||input.seed>2147483647,'seed must be a non-negative 32-bit integer');
  const refs=['scenarioVersion','mapDigest','sensorModelDigest','policyDigest','engineVersion'];
  for(const field of refs) fail(typeof input[field]!=='string'||input[field].length<3,`${field} is required`);
  fail(!/^[a-f0-9]{64}$/.test(input.mapDigest)||!/^[a-f0-9]{64}$/.test(input.sensorModelDigest)||!/^[a-f0-9]{64}$/.test(input.policyDigest),'input digests must be SHA-256');
  const timeoutSeconds=Number(input.timeoutSeconds); const cpuCores=Number(input.cpuCores); const memoryMb=Number(input.memoryMb);
  fail(!Number.isInteger(timeoutSeconds)||timeoutSeconds<1||timeoutSeconds>3600,'timeout must be 1-3600 seconds');
  fail(!Number.isInteger(cpuCores)||cpuCores<1||cpuCores>16,'cpuCores must be 1-16');
  fail(!Number.isInteger(memoryMb)||memoryMb<256||memoryMb>32768,'memoryMb must be 256-32768');
  fail(input.sandboxProfile!=='no-network-readonly-inputs','sandboxed no-network execution is required');
  const spec={seed:input.seed,scenarioVersion:input.scenarioVersion,mapDigest:input.mapDigest,sensorModelDigest:input.sensorModelDigest,policyDigest:input.policyDigest,engineVersion:input.engineVersion,timeoutSeconds,cpuCores,memoryMb,sandboxProfile:input.sandboxProfile};
  return {spec,runDigest:digest(spec)};
}
function evaluateMetrics(input){
  const numeric=['distanceM','collisions','infractions','minimumTtcSeconds','completionSeconds']; for(const f of numeric) fail(!Number.isFinite(Number(input[f]))||Number(input[f])<0,`${f} must be non-negative`,'INVALID_METRICS');
  const metrics={distanceM:Number(input.distanceM),collisions:Number(input.collisions),infractions:Number(input.infractions),minimumTtcSeconds:Number(input.minimumTtcSeconds),completionSeconds:Number(input.completionSeconds),edgeCases:[...new Set(input.edgeCases||[])].sort()};
  return {...metrics,passedLocalThresholds:metrics.collisions===0&&metrics.infractions===0&&metrics.minimumTtcSeconds>=1.5,safetyValidated:false,limitation:'Simulation metrics do not establish real-world safety.'};
}
function compareRuns(candidate,baseline){
  fail(candidate.runDigest===baseline.runDigest,'candidate and baseline must be distinct','INVALID_COMPARISON');
  return {collisionDelta:candidate.metrics.collisions-baseline.metrics.collisions,infractionDelta:candidate.metrics.infractions-baseline.metrics.infractions,minimumTtcDelta:candidate.metrics.minimumTtcSeconds-baseline.metrics.minimumTtcSeconds,regression:candidate.metrics.collisions>baseline.metrics.collisions||candidate.metrics.infractions>baseline.metrics.infractions||candidate.metrics.minimumTtcSeconds<baseline.metrics.minimumTtcSeconds};
}
module.exports={validateRun,evaluateMetrics,compareRuns};
