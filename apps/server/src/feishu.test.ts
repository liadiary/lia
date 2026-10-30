import { describe, expect, it } from "vitest";
import { dataSources, hasFeishuCredentials } from "./feishu.js";

describe("Feishu read-only connector", () => {
  it("defines the four confirmed data sources", () => expect(dataSources).toHaveLength(4));
  it("remains safely disabled without credentials", () => expect(hasFeishuCredentials()).toBe(false));
});
