import { describe, expect, it } from "vitest";
import { PATCH as patchStaff } from "@/app/api/admin/v1/staff/route";

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("admin access control APIs", () => {
  it("updates an assignable staff role in demo mode", async () => {
    const response = await patchStaff(request("/api/admin/v1/staff", {
      staffId: "90000000-0000-0000-0000-000000000002",
      role: "receptionist",
      status: "active",
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).data.status).toBe("sandbox");
  });
});
