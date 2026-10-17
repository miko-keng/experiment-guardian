import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/env.js";

describe("application environment configuration", () => {
  it("uses documented defaults for an empty environment", () => {
    const config = loadConfig({});

    expect(config.port).toBe(3001);
    expect(config.allowMockAi).toBe(false);
    expect(config.persistTranscripts).toBe(true);
    expect(config.maxTranscriptCharacters).toBe(50000);
  });

  it("rejects invalid values with the variable name and without echoing secrets", () => {
    const secret = "do-not-include-this-secret";

    expect(() => loadConfig({ PORT: "not-a-port", AWS_BEARER_TOKEN_BEDROCK: secret }))
      .toThrow(/PORT/);
    try {
      loadConfig({ PORT: "not-a-port", AWS_BEARER_TOKEN_BEDROCK: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });

  it("rejects invalid boolean and out-of-range temperature values", () => {
    expect(() => loadConfig({ ALLOW_MOCK_AI: "yes" })).toThrow(/ALLOW_MOCK_AI/);
    expect(() => loadConfig({ BEDROCK_TEMPERATURE: "1.5" })).toThrow(/BEDROCK_TEMPERATURE/);
  });
});
