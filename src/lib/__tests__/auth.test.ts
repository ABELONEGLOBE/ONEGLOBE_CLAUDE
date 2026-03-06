// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(payload: object, expiresIn = "7d") {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  test("sets an http-only cookie with a signed JWT", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, token, options] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe("auth-token");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/");
  });

  test("cookie expires in ~7 days", async () => {
    const { createSession } = await import("@/lib/auth");
    const before = Date.now();
    await createSession("user-123", "test@example.com");
    const after = Date.now();

    const expires: Date = mockCookieStore.set.mock.calls[0][2].expires;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  test("JWT payload contains userId and email", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");

    const token = mockCookieStore.set.mock.calls[0][1];
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.userId).toBe("user-123");
    expect(payload.email).toBe("test@example.com");
  });

  test("cookie has sameSite lax", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");

    const options = mockCookieStore.set.mock.calls[0][2];
    expect(options.sameSite).toBe("lax");
  });

  test("cookie is not secure outside production", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");

    const options = mockCookieStore.set.mock.calls[0][2];
    expect(options.secure).toBe(false);
  });

  test("cookie is secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { createSession } = await import("@/lib/auth");
    await createSession("user-123", "test@example.com");

    const options = mockCookieStore.set.mock.calls[0][2];
    expect(options.secure).toBe(true);

    vi.unstubAllEnvs();
  });

  test("different users get different tokens", async () => {
    const { createSession } = await import("@/lib/auth");
    await createSession("user-1", "a@example.com");
    await createSession("user-2", "b@example.com");

    const token1 = mockCookieStore.set.mock.calls[0][1];
    const token2 = mockCookieStore.set.mock.calls[1][1];
    expect(token1).not.toBe(token2);
  });
});

describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const payload = { userId: "user-123", email: "test@example.com", expiresAt: new Date() };
    const token = await makeToken(payload);
    mockCookieStore.get.mockReturnValue({ value: token });

    const { getSession } = await import("@/lib/auth");
    const session = await getSession();

    expect(session?.userId).toBe("user-123");
    expect(session?.email).toBe("test@example.com");
  });

  test("returns null for an invalid token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "invalid.token.here" });
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken({ userId: "u1", email: "a@b.com" }, "-1s");
    mockCookieStore.get.mockReturnValue({ value: token });
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    expect(session).toBeNull();
  });
});

describe("deleteSession", () => {
  test("deletes the auth-token cookie", async () => {
    const { deleteSession } = await import("@/lib/auth");
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  test("returns null when request has no cookie", async () => {
    const req = new NextRequest("http://localhost/");
    const { verifySession } = await import("@/lib/auth");
    const session = await verifySession(req);
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token in request", async () => {
    const payload = { userId: "user-456", email: "req@example.com", expiresAt: new Date() };
    const token = await makeToken(payload);
    const req = new NextRequest("http://localhost/", {
      headers: { cookie: `auth-token=${token}` },
    });

    const { verifySession } = await import("@/lib/auth");
    const session = await verifySession(req);

    expect(session?.userId).toBe("user-456");
    expect(session?.email).toBe("req@example.com");
  });

  test("returns null for an invalid token in request", async () => {
    const req = new NextRequest("http://localhost/", {
      headers: { cookie: "auth-token=bad.token.value" },
    });
    const { verifySession } = await import("@/lib/auth");
    const session = await verifySession(req);
    expect(session).toBeNull();
  });

  test("returns null for an expired token in request", async () => {
    const token = await makeToken({ userId: "u1", email: "a@b.com" }, "-1s");
    const req = new NextRequest("http://localhost/", {
      headers: { cookie: `auth-token=${token}` },
    });
    const { verifySession } = await import("@/lib/auth");
    const session = await verifySession(req);
    expect(session).toBeNull();
  });
});
