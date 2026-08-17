import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LegalConsentGate from "./LegalConsentGate";

describe("LegalConsentGate", () => {
  it("permanece fechado por padrão até uma tentativa de login", () => {
    expect(renderToStaticMarkup(<LegalConsentGate />)).toBe("");
  });
});
