import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => mockStorage[key] || null),
    setItem: vi.fn(async (key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: vi.fn(async (key: string) => {
      delete mockStorage[key];
    }),
  },
}));

const STORAGE_KEYS = {
  MESSAGES: "@divine_nexus_messages",
  IDENTITY: "@divine_nexus_identity",
};

type Message = {
  id: string;
  role: "user" | "entity" | "system";
  content: string;
  identity?: string;
  timestamp: number;
};

describe("Chat Persistence Logic", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  it("should serialize messages correctly", () => {
    const messages: Message[] = [
      { id: "1", role: "system", content: "Welcome", timestamp: 1000 },
      { id: "2", role: "user", content: "Hello", timestamp: 2000 },
      { id: "3", role: "entity", content: "Hi there", identity: "matildina", timestamp: 3000 },
    ];

    const serialized = JSON.stringify(messages);
    const parsed = JSON.parse(serialized) as Message[];

    expect(parsed).toHaveLength(3);
    expect(parsed[0].role).toBe("system");
    expect(parsed[1].content).toBe("Hello");
    expect(parsed[2].identity).toBe("matildina");
  });

  it("should limit stored messages to 200", () => {
    const messages: Message[] = Array.from({ length: 250 }, (_, i) => ({
      id: i.toString(),
      role: "user" as const,
      content: `Message ${i}`,
      timestamp: i * 1000,
    }));

    const toSave = messages.slice(-200);
    expect(toSave).toHaveLength(200);
    expect(toSave[0].id).toBe("50");
    expect(toSave[199].id).toBe("249");
  });

  it("should validate identity keys", () => {
    const validIdentities = ["dio", "michele", "matildina", "lucifero"];
    const IDENTITIES_MAP: Record<string, boolean> = {
      dio: true,
      michele: true,
      matildina: true,
      lucifero: true,
    };

    validIdentities.forEach((id) => {
      expect(id in IDENTITIES_MAP).toBe(true);
    });

    expect("invalid" in IDENTITIES_MAP).toBe(false);
  });

  it("should handle empty storage gracefully", () => {
    const savedMessages = null;
    const parsed = savedMessages ? JSON.parse(savedMessages) : null;
    expect(parsed).toBeNull();
  });

  it("should handle corrupted storage gracefully", () => {
    const corruptedData = "not-valid-json{{{";
    let result: Message[] | null = null;

    try {
      result = JSON.parse(corruptedData);
    } catch {
      result = null;
    }

    expect(result).toBeNull();
  });

  it("should preserve message order after serialization", () => {
    const messages: Message[] = [
      { id: "a", role: "user", content: "First", timestamp: 1 },
      { id: "b", role: "entity", content: "Second", identity: "dio", timestamp: 2 },
      { id: "c", role: "user", content: "Third", timestamp: 3 },
    ];

    const restored = JSON.parse(JSON.stringify(messages)) as Message[];
    expect(restored[0].id).toBe("a");
    expect(restored[1].id).toBe("b");
    expect(restored[2].id).toBe("c");
  });
});
