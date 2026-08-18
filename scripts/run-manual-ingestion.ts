import { runWednesdayRoutineNow } from "../server/manual-ingestion";

const result = await runWednesdayRoutineNow();
console.log(JSON.stringify(result, null, 2));
