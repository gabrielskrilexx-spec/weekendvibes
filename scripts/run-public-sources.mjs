import { runPublicAgendaStep } from "../server/agenda-routine.ts";

const result = await runPublicAgendaStep({ sourceKey: "public" });
const output = {
  status: "completed",
  routine: "public-agenda",
  archived: result.archived,
  result: result.result,
};
console.log(JSON.stringify(output, null, 2));
