export function sanitizeEventText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/```[\s\S]*?```/g, match => match.replace(/```/g, ""))
    .replace(/(^|\s)#{1,6}\s+/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
