import { test, expect } from "@playwright/test";
import { MAX_POST_BODY_BYTES } from "../../src/limits";

const OVERSIZE_PADDING_BYTES = 2048;

function oversizedText(byteLimit: number): string {
  return "x".repeat(byteLimit + OVERSIZE_PADDING_BYTES);
}

function regularText(): string {
  return "normal-payload";
}

test.describe("POST payload limits", () => {
  test("rejects oversized /service-request body with 413", async ({ request }) => {
    const response = await request.post("/service-request", {
      data: {
        clientId: "client_limit_test",
        serviceType: oversizedText(MAX_POST_BODY_BYTES),
      },
    });
    const payload = await response.json();

    expect(response.status()).toBe(413);
    expect(payload).toEqual({
      success: false,
      error: `Payload too large. Maximum allowed is ${MAX_POST_BODY_BYTES} bytes.`,
    });
  });

  test("rejects oversized /verify-client body with 413", async ({ request }) => {
    const response = await request.post("/verify-client", {
      data: {
        clientId: oversizedText(MAX_POST_BODY_BYTES),
        clientCertificate: "dummy-cert",
      },
    });
    const payload = await response.json();

    expect(response.status()).toBe(413);
    expect(payload).toEqual({
      success: false,
      error: `Payload too large. Maximum allowed is ${MAX_POST_BODY_BYTES} bytes.`,
    });
  });

  test("keeps small invalid requests out of 413 path", async ({ request }) => {
    const response = await request.post("/service-request", {
      data: {
        clientId: "client_limit_test",
      },
    });

    expect(response.status()).not.toBe(413);
    expect([400, 401, 403]).toContain(response.status());
  });

  test("accepts regular /service-request payload (processed by route validation)", async ({ request }) => {
    const response = await request.post("/service-request", {
      data: {
        clientId: "client_regular_test",
        serviceType: regularText(),
        clientCertificate: "dummy-cert",
      },
    });
    const payload = await response.json();

    expect(response.status()).not.toBe(413);
    expect(String(payload.error ?? "")).not.toContain("Payload too large");
    expect([200, 401, 403]).toContain(response.status());
  });

  test("accepts regular /verify-client payload (processed by route validation)", async ({ request }) => {
    const response = await request.post("/verify-client", {
      data: {
        clientId: "client_regular_test",
        clientCertificate: "dummy-cert",
      },
    });
    const payload = await response.json();

    expect(response.status()).not.toBe(413);
    expect(String(payload.error ?? "")).not.toContain("Payload too large");
    expect([200, 401]).toContain(response.status());
  });
});
