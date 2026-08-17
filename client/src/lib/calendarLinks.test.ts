import { describe, expect, it } from "vitest";
import { buildGoogleCalendarUrl, buildIcsCalendar } from "./calendarLinks";

const input = {
  title: "Samba no Moby",
  start: "2026-08-22T22:00:00.000Z",
  end: "2026-08-23T01:00:00.000Z",
  description: "Uma noite de samba, pagode e amigos.",
  location: "Moby House, Santos, SP",
  url: "https://weekendvib-jscaalye.manus.space/eventos/samba-no-moby",
};

describe("calendarLinks", () => {
  it("gera URL do Google Calendar com dados codificados", () => {
    const url = buildGoogleCalendarUrl(input);
    expect(url).toContain("https://calendar.google.com/calendar/render?");
    expect(url).toContain("text=Samba+no+Moby");
    expect(url).toContain("dates=20260822T220000Z%2F20260823T010000Z");
    expect(url).toContain("location=Moby+House%2C+Santos%2C+SP");
  });

  it("gera arquivo iCalendar compatível com Apple Calendar", () => {
    const ics = buildIcsCalendar(input);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Samba no Moby");
    expect(ics).toContain("DTSTART:20260822T220000Z");
    expect(ics).toContain("DTEND:20260823T010000Z");
    expect(ics).toContain("LOCATION:Moby House\\, Santos\\, SP");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("aplica duração padrão de duas horas quando não há fim", () => {
    const url = buildGoogleCalendarUrl({ title: "Evento curto", start: input.start });
    expect(url).toContain("dates=20260822T220000Z%2F20260823T000000Z");
  });
});
