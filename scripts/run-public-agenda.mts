import { runPublicAgendaStep } from "../server/agenda-routine";

const result = await runPublicAgendaStep({ track: true, sourceKey: "public" });
console.log(JSON.stringify(result, null, 2));
