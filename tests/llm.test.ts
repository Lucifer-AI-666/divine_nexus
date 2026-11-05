import { afterEach, describe, expect, it, vi } from "vitest";

process.env.LLM_API_KEY = "test-key";
process.env.LLM_API_URL = "https://llm.example.com/v1/";
process.env.LLM_MODEL = "test-model";
process.env.LLM_VISION_MODEL = "test-vision-model";

describe("invokeLLM", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls the configured OpenAI-compatible endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("../server/_core/llm");
    await invokeLLM({ messages: [{ role: "user", content: "ciao" }] });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://llm.example.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body as string).model).toBe("test-model");
  });

  it("uses the configured vision model for image requests", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("../server/_core/llm");
    await invokeLLM({
      messages: [
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: "https://example.com/image.png" } }],
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).model).toBe("test-vision-model");
  });

  it("requires a vision model for image requests", async () => {
    process.env.LLM_VISION_MODEL = "";
    vi.resetModules();

    const { invokeLLM } = await import("../server/_core/llm");
    await expect(
      invokeLLM({
        messages: [
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: "https://example.com/image.png" } }],
          },
        ],
      }),
    ).rejects.toThrow("LLM_VISION_MODEL must be configured for image requests");
  });
});
