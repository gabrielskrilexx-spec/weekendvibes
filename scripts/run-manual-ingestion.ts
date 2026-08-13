import { runTuesdayRoutineNow } from "../server/manual-ingestion";

const result = await runTuesdayRoutineNow();
console.log(JSON.stringify(result, null, 2));
