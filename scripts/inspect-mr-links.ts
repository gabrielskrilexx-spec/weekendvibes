import { readFileSync } from "node:fs";
import { extractMrIngressosListingEvents, extractPublicEventLinks } from "../server/ingestion";
const html = readFileSync("/tmp/mr-home.html", "utf8");
console.log(JSON.stringify({ specific: extractMrIngressosListingEvents(html).slice(0, 5), generic: extractPublicEventLinks(html, "https://mringressos.com.br/").slice(0, 5), genericCount: extractPublicEventLinks(html, "https://mringressos.com.br/").length }, null, 2));
