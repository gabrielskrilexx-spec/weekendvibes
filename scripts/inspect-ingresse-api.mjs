import fs from "node:fs";

const payload = JSON.parse(fs.readFileSync("/tmp/ingresse-event.json", "utf8"));
const pick = (value) => {
  if (Array.isArray(value)) return value.slice(0, 10).map(pick);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => /^(id|title|slug|date|dateTime|start|end|name|city|state|address|latitude|longitude|place|sessions|venue|location|config|status|salesEnabled)$/i.test(key)).map(([key, item]) => [key, pick(item)]));
  }
  return value;
};
console.log(JSON.stringify(pick(payload), null, 2));
