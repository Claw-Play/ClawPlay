import { describe, expect, it } from "vitest";
import { middleware } from "@/middleware";
import { makeRequest } from "./helpers/request";

describe("middleware auth redirects", () => {
  it("redirects protected pages to the public login URL with from param", () => {
    process.env.BASE_URL = "https://clawplay.shop:3000";
    const request = makeRequest("GET", "/dashboard", {
      proxyHost: "clawplay.shop",
      proxyProto: "https",
    });

    const response = middleware(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("https://clawplay.shop/login?from=%2Fdashboard");
    expect(location).not.toContain(":3000");
  });

  it("allows protected pages through when auth cookie is present", () => {
    const request = makeRequest("GET", "/dashboard", {
      cookie: "clawplay_token=test-token",
    });

    const response = middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
