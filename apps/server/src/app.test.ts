import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app.js";
describe("API", () => { it("reports health", async () => { const res = await request(app).get("/api/health"); expect(res.status).toBe(200); expect(res.body.database).toBe("connected"); }); });
