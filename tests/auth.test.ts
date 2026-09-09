import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const model = () => ({
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  });
  const db = {
    business: model(),
    user: model(),
    userSession: model(),
    auditLog: model(),
    customer: model(),
    creditTransaction: model(),
    payment: model(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
  return {
    db,
    jar: new Map<string, string>(),
    set: vi.fn(),
    remove: vi.fn(),
    headers: new Map<string, string>(),
    limit: vi.fn(),
    accountLimit: vi.fn(),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) => (mocks.jar.has(key) ? { value: mocks.jar.get(key) } : undefined),
    set: mocks.set,
    delete: mocks.remove,
  }),
  headers: async () => ({ get: (key: string) => mocks.headers.get(key) ?? null }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("REDIRECT:" + path);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-rate-limit", () => ({
  checkAuthRateLimit: mocks.limit,
  consumeAuthLimit: mocks.accountLimit,
}));

import { registerAction, signInAction, signOutAction } from "@/app/actions/auth";
import { getSession, destroySession, setSessionCookie } from "@/lib/auth";
import { getCurrentActor, requireActor, requirePermission, tenantWhere } from "@/lib/tenant";
import { newSession, hashToken, SESSION_COOKIE } from "@/lib/session-token";
import { identifierSchema, passwordSchema, registerSchema } from "@/lib/auth-validation";
import { can } from "@/lib/permissions";
import { assertSameOrigin } from "@/lib/csrf";
import { saveOnboardingStepAction } from "@/app/actions/onboarding";
import { updateStaffAccessAction } from "@/app/actions/staff";
import { createStaffAction, updateBusinessSettingsAction } from "@/app/actions/business";
import {
  archiveCustomerAction,
  createCustomerAction,
  updateCustomerAction,
} from "@/app/actions/customers";
import {
  reverseTransactionAction,
  recordCreditAction,
  recordPaymentAction,
  queueManualReminderAction,
} from "@/app/actions/ledger";

const businessId = "10000000-0000-4000-8000-000000000010";
const userId = "20000000-0000-4000-8000-000000000010";
const otherId = "30000000-0000-4000-8000-000000000099";
const password = "Stage3TestPassword!";
const storedHash = bcrypt.hashSync(password, 12);
const form = (data: Record<string, string>) => {
  const result = new FormData();
  Object.entries(data).forEach(([key, value]) => result.set(key, value));
  return result;
};
const profile = () => ({
  id: userId,
  businessId,
  name: "Test Owner",
  email: "owner@example.test",
  phone: null,
  role: "OWNER",
  active: true,
  canReverseTransactions: false,
  passwordHash: storedHash,
  business: {
    id: businessId,
    active: true,
    onboardingCompletedAt: new Date(),
    onboardingStep: 1,
    businessName: "Test Shop",
    defaultCreditDueDays: 7,
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.jar.clear();
  mocks.headers.clear();
  mocks.headers.set("origin", "http://localhost:3000");
  process.env.DATABASE_URL = "postgresql://example:placeholder@localhost:5432/test";
  process.env.AUTH_SECRET = "test-only-auth-secret-at-least-32-characters";
  process.env.APP_ORIGIN = "http://localhost:3000";
  mocks.db.$transaction.mockImplementation(async (callback) => callback(mocks.db));
  mocks.limit.mockResolvedValue({ allowed: true });
  mocks.accountLimit.mockResolvedValue({ allowed: true });
  mocks.db.userSession.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.business.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.user.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.business.create.mockResolvedValue({ id: businessId });
  mocks.db.user.create.mockResolvedValue({ id: userId, role: "OWNER" });
  mocks.db.user.findFirst.mockResolvedValue(profile());
  mocks.db.userSession.findFirst.mockResolvedValue({
    id: "session-id",
    userId,
    lastUsedAt: new Date(),
  });
});
function signedIn(role: "OWNER" | "STAFF" = "OWNER") {
  mocks.jar.set(SESSION_COOKIE, newSession().token);
  const user = { ...profile(), role };
  mocks.db.user.findFirst.mockResolvedValue(user);
  return user;
}

describe("input and permission boundaries", () => {
  it("normalizes all supported phone formats and email casing", () => {
    for (const input of ["0712 345 678", "255712345678", "+255712345678"]) {
      expect(identifierSchema.parse(input)).toEqual({ email: null, phone: "+255712345678" });
    }
    expect(identifierSchema.parse(" OWNER@EXAMPLE.TEST ")).toEqual({
      email: "owner@example.test",
      phone: null,
    });
    expect(identifierSchema.safeParse("not-an-email").success).toBe(false);
  });
  it("rejects short passwords and bcrypt byte truncation", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse("😀".repeat(19)).success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
    expect(
      registerSchema.safeParse({
        name: "A",
        identifier: "a@b.test",
        password,
        businessName: "Shop",
      }).success,
    ).toBe(false);
  });
  it("grants the requested owner/staff matrix and denies unknown permissions", () => {
    for (const permission of [
      "view_customers",
      "add_customers",
      "record_credit",
      "record_payment",
      "view_transactions",
    ] as const) {
      expect(can("STAFF", permission)).toBe(true);
      expect(can("OWNER", permission)).toBe(true);
    }
    for (const permission of [
      "manage_customers",
      "send_reminders",
      "configure_reminders",
      "configure_sms",
      "reverse_transactions",
      "view_reports",
      "manage_business",
      "manage_staff",
      "manage_billing",
      "change_ownership",
    ] as const) {
      expect(can("STAFF", permission)).toBe(false);
      expect(can("OWNER", permission)).toBe(true);
    }
    expect(can("STAFF", "reverse_transactions", true)).toBe(true);
    expect(can("STAFF", "manage_staff", true)).toBe(false);
    expect(can("OWNER", "delete_financial_records" as never)).toBe(false);
    expect(can("UNKNOWN" as never, "view_customers")).toBe(false);
  });
  it("rejects missing and cross-site origins", async () => {
    mocks.headers.clear();
    await expect(assertSameOrigin()).rejects.toThrow("blocked");
    mocks.headers.set("origin", "https://evil.example");
    await expect(assertSameOrigin()).rejects.toThrow("untrusted");
    mocks.headers.set("origin", "http://localhost:3000");
    mocks.headers.set("sec-fetch-site", "cross-site");
    await expect(assertSameOrigin()).rejects.toThrow("blocked");
  });
});

describe("sessions and tenant isolation", () => {
  it("uses unpredictable tokens and stores only SHA-256 hashes", () => {
    const a = newSession(),
      b = newSession();
    expect(a.token).toHaveLength(43);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashToken(a.token));
    expect(a.tokenHash).not.toBe(a.token);
  });
  it("rejects malformed and missing session cookies without querying", async () => {
    expect(await getSession()).toBeNull();
    mocks.jar.set(SESSION_COOKIE, "tampered");
    expect(await getSession()).toBeNull();
    expect(mocks.db.userSession.findFirst).not.toHaveBeenCalled();
  });
  it("requires a live, unrevoked, unexpired session and active user/business", async () => {
    signedIn();
    mocks.db.userSession.findFirst.mockResolvedValue(null);
    expect(await getSession()).toBeNull();
    const query = mocks.db.userSession.findFirst.mock.calls[0][0];
    expect(query.where).toMatchObject({
      revokedAt: null,
      user: { active: true, business: { active: true } },
    });
    expect(query.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(query.where.createdAt.gt).toBeInstanceOf(Date);
    expect(query.where.OR[0].lastUsedAt.gt).toBeInstanceOf(Date);
    expect(query.select).not.toHaveProperty("user");
  });
  it("ignores forged tenant cookies and loads fresh role data", async () => {
    signedIn("STAFF");
    mocks.jar.set("kidaftari_business", otherId);
    const actor = await getCurrentActor();
    expect(actor?.business.id).toBe(businessId);
    expect(actor?.user.role).toBe("STAFF");
    expect(mocks.db.user.findFirst.mock.calls[0][0].select).not.toHaveProperty("passwordHash");
    expect(tenantWhere(businessId, { businessId: otherId, id: otherId })).toEqual({
      businessId,
      id: otherId,
    });
  });
  it("redirects anonymous, incomplete, and forbidden page requests", async () => {
    await expect(requireActor()).rejects.toThrow("REDIRECT:/login");
    const user = signedIn();
    user.business.onboardingCompletedAt = null as never;
    await expect(requireActor()).rejects.toThrow("REDIRECT:/onboarding");
    signedIn("STAFF");
    await expect(requirePermission("view_reports")).rejects.toThrow("REDIRECT:/access-denied");
  });
  it("revokes server-side sessions before clearing cookies", async () => {
    signedIn();
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.db.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ revokedAt: null }),
        data: { revokedAt: expect.any(Date) },
      }),
    );
    expect(mocks.remove).toHaveBeenCalledWith(SESSION_COOKIE);
    mocks.remove.mockClear();
    mocks.db.userSession.updateMany.mockRejectedValue(new Error("offline"));
    await expect(destroySession()).rejects.toThrow("offline");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("sets production cookies with HttpOnly, Secure, SameSite and expiry", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await setSessionCookie(newSession().token, new Date());
    expect(mocks.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        expires: expect.any(Date),
      }),
    );
    vi.unstubAllEnvs();
  });
});

describe("registration and login", () => {
  it("atomically creates business, owner, audit, and session, ignoring client role/tenant", async () => {
    await expect(
      registerAction(
        {},
        form({
          name: "Owner",
          identifier: "0712345678",
          password,
          businessName: "Shop",
          businessPhone: "0712345678",
          role: "STAFF",
          businessId: otherId,
        }),
      ),
    ).rejects.toThrow("REDIRECT:/onboarding");
    expect(mocks.db.$transaction).toHaveBeenCalledOnce();
    const data = mocks.db.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ role: "OWNER", businessId, email: null, phone: "+255712345678" });
    expect(await bcrypt.compare(password, data.passwordHash)).toBe(true);
    expect(bcrypt.getRounds(data.passwordHash)).toBe(12);
    expect(mocks.db.auditLog.create).toHaveBeenCalledOnce();
    expect(mocks.db.userSession.create.mock.calls[0][0].data).not.toHaveProperty("token");
  });
  it("handles duplicate and database errors without issuing a session cookie", async () => {
    mocks.db.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const state = await registerAction(
      {},
      form({
        name: "Owner",
        identifier: "a@b.test",
        password,
        businessName: "Shop",
        businessPhone: "0712345678",
      }),
    );
    expect(state.message).toContain("Unable to register");
    expect(mocks.set).not.toHaveBeenCalled();
    mocks.db.user.findFirst.mockRejectedValue(new Error("database password should never appear"));
    const login = await signInAction({}, form({ identifier: "a@b.test", password }));
    expect(login.message).toContain("temporarily unavailable");
    expect(login.message).not.toContain("database password");
  });
  it("returns the same credential error for unknown accounts and wrong passwords", async () => {
    mocks.db.user.findFirst.mockResolvedValue(null);
    const absent = await signInAction({}, form({ identifier: "absent@example.test", password }));
    mocks.db.user.findFirst.mockResolvedValue(profile());
    const wrong = await signInAction(
      {},
      form({ identifier: "owner@example.test", password: "WrongPassword!" }),
    );
    expect(absent).toEqual(wrong);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("rotates an existing session on login and resumes unfinished onboarding", async () => {
    const user = signedIn();
    user.business.onboardingCompletedAt = null as never;
    await expect(
      signInAction({}, form({ identifier: "OWNER@EXAMPLE.TEST", password })),
    ).rejects.toThrow("REDIRECT:/onboarding");
    expect(mocks.db.userSession.updateMany).toHaveBeenCalledOnce();
    expect(mocks.db.userSession.create).toHaveBeenCalledOnce();
    expect(mocks.set.mock.calls[0][1]).not.toBe(mocks.jar.get(SESSION_COOKIE));
  });
  it("blocks throttled attempts before account/password lookup", async () => {
    mocks.limit.mockResolvedValue({ allowed: false, retryAfterSeconds: 900 });
    const result = await signInAction({}, form({ identifier: "owner@example.test", password }));
    expect(result.message).toContain("900");
    expect(mocks.db.user.findFirst).not.toHaveBeenCalled();
  });
});

describe("onboarding and staff authorization", () => {
  it("rejects skipped steps and staff submissions", async () => {
    const user = signedIn();
    user.business.onboardingCompletedAt = null as never;
    expect(
      (await saveOnboardingStepAction({}, form({ step: "5", remindersEnabled: "true" }))).message,
    ).toContain("earlier");
    user.role = "STAFF";
    expect(
      (await saveOnboardingStepAction({}, form({ step: "1", businessName: "Changed" }))).message,
    ).toContain("owner");
    expect(mocks.db.business.updateMany).not.toHaveBeenCalled();
  });
  it("saves each step against the session business and finishes with an audit entry", async () => {
    const user = signedIn();
    user.business.onboardingCompletedAt = null as never;
    const fields: Record<string, string>[] = [
      { step: "1", businessName: "Changed" },
      { step: "2", businessPhone: "0712345678" },
      { step: "3", address: "Dar es Salaam" },
      { step: "4", language: "SW" },
      { step: "5", remindersEnabled: "false" },
    ];
    for (let i = 0; i < fields.length; i++) {
      user.business.onboardingStep = i + 1;
      await expect(
        saveOnboardingStepAction(
          {},
          form({ ...fields[i], businessId: otherId } as Record<string, string>),
        ),
      ).rejects.toThrow(i === 4 ? "REDIRECT:/dashboard" : "REDIRECT:/onboarding");
      expect(mocks.db.business.updateMany.mock.calls[i][0].where).toMatchObject({
        id: businessId,
        onboardingCompletedAt: null,
        onboardingStep: i + 1,
      });
    }
    expect(mocks.db.business.updateMany.mock.lastCall?.[0].data).toMatchObject({
      remindersEnabled: false,
      onboardingCompletedAt: expect.any(Date),
    });
    expect(mocks.db.auditLog.create).toHaveBeenCalledOnce();
  });
  it("denies staff calls to every owner-only mutation before writing", async () => {
    signedIn("STAFF");
    await expect(createStaffAction({}, form({}))).rejects.toThrow("permission");
    await expect(updateBusinessSettingsAction({}, form({}))).rejects.toThrow("permission");
    await expect(archiveCustomerAction(otherId)).rejects.toThrow("permission");
    await expect(reverseTransactionAction({}, form({}))).rejects.toThrow("permission");
    await expect(queueManualReminderAction({}, form({}))).rejects.toThrow("permission");
    expect((await updateStaffAccessAction({}, form({}))).message).toContain("owner");
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it("cannot target another business customer when recording credit or payment", async () => {
    signedIn("STAFF");
    mocks.db.customer.findFirst.mockResolvedValue(null);
    const credit = await recordCreditAction(
      {},
      form({ customerId: otherId, amountTzs: "100", dueDate: "", description: "" }),
    );
    expect(credit.message).toContain("not found");
    const payment = await recordPaymentAction(
      {},
      form({
        customerId: otherId,
        amountTzs: "100",
        occurredAt: "2026-09-08",
        paymentMethod: "CASH",
        paymentReference: "",
        description: "",
      }),
    );
    expect(payment.message).toContain("not found");
    for (const [query] of mocks.db.customer.findFirst.mock.calls)
      expect(query.where).toMatchObject({ id: otherId, businessId });
    expect(mocks.db.creditTransaction.create).not.toHaveBeenCalled();
    expect(mocks.db.payment.create).not.toHaveBeenCalled();
  });
  it("scopes staff management to same-business STAFF rows and revokes sessions", async () => {
    signedIn();
    mocks.db.user.findFirst
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce({ id: otherId, active: true, canReverseTransactions: false });
    const result = await updateStaffAccessAction(
      {},
      form({
        userId: otherId,
        active: "false",
        canReverseTransactions: "true",
        businessId: "forged",
      }),
    );
    expect(result.success).toBe(true);
    expect(mocks.db.user.updateMany).toHaveBeenCalledWith({
      where: { id: otherId, businessId, role: "STAFF" },
      data: { active: false, canReverseTransactions: true },
    });
    expect(mocks.db.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: otherId, revokedAt: null } }),
    );
  });
});

describe("stage 4 customer mutations", () => {
  const customerFields = {
    fullName: "Neema Juma",
    phone: "0712 345 678",
    alternativePhone: "0755 111 222",
    address: "Mwanza",
    creditLimit: "50000",
    reminderEnabled: "on",
    reminderFrequency: "7",
    preferredLanguage: "SW",
    notes: "Pays on Fridays",
  };

  it("creates the next readable number atomically for the signed-in business", async () => {
    signedIn("STAFF");
    mocks.db.business.update.mockResolvedValue({ nextCustomerNumber: 2 });
    mocks.db.customer.create.mockResolvedValue({
      id: otherId,
      customerNumber: "KDF-000001",
      fullName: "Neema Juma",
      phone: "+255712345678",
    });

    await expect(createCustomerAction({}, form(customerFields))).rejects.toThrow(
      "REDIRECT:/customers/" + otherId + "?created=1",
    );
    expect(mocks.db.business.update).toHaveBeenCalledWith({
      where: { id: businessId },
      data: { nextCustomerNumber: { increment: 1 } },
      select: { nextCustomerNumber: true },
    });
    expect(mocks.db.customer.create.mock.calls[0][0].data).toMatchObject({
      businessId,
      customerNumber: "KDF-000001",
      phone: "+255712345678",
      alternativePhone: "+255755111222",
      preferredLanguage: "SW",
      createdById: userId,
    });
  });

  it("validates required Tanzania phone numbers before writing", async () => {
    signedIn("STAFF");
    const result = await createCustomerAction(
      {},
      form({ ...customerFields, phone: "020 123 4567" }),
    );
    expect(result.message).toContain("Tanzanian mobile");
    expect(mocks.db.customer.create).not.toHaveBeenCalled();
  });

  it("scopes edits to active customers in the signed-in business", async () => {
    signedIn();
    mocks.db.customer.findFirst.mockResolvedValue(null);
    const result = await updateCustomerAction(
      {},
      form({ ...customerFields, customerId: otherId, businessId: "forged" }),
    );
    expect(result.message).toContain("not found");
    expect(mocks.db.customer.findFirst).toHaveBeenCalledWith({
      where: { id: otherId, businessId, active: true },
    });
    expect(mocks.db.customer.updateMany).not.toHaveBeenCalled();
  });

  it("updates customer details without changing the customer number or tenant", async () => {
    signedIn();
    mocks.db.customer.findFirst.mockResolvedValue({
      id: otherId,
      businessId,
      customerNumber: "KDF-000001",
      fullName: "Old Name",
      phone: "+255712000000",
      creditLimit: null,
    });
    mocks.db.customer.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      updateCustomerAction({}, form({ ...customerFields, customerId: otherId })),
    ).rejects.toThrow("REDIRECT:/customers/" + otherId + "?updated=1");
    const update = mocks.db.customer.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({ id: otherId, businessId, active: true });
    expect(update.data).toMatchObject({
      fullName: "Neema Juma",
      phone: "+255712345678",
      creditLimit: 50000,
      updatedById: userId,
    });
    expect(update.data).not.toHaveProperty("customerNumber");
    expect(update.data).not.toHaveProperty("businessId");
  });

  it("deactivates without deleting financial history", async () => {
    signedIn();
    mocks.db.customer.findFirst.mockResolvedValue({
      id: otherId,
      fullName: "Neema Juma",
      _count: { creditTransactions: 2, payments: 1 },
    });
    mocks.db.customer.updateMany.mockResolvedValue({ count: 1 });

    await expect(archiveCustomerAction(otherId)).rejects.toThrow(
      "REDIRECT:/customers?deactivated=1",
    );
    expect(mocks.db.customer.updateMany).toHaveBeenCalledWith({
      where: { id: otherId, businessId, active: true },
      data: {
        active: false,
        archivedAt: expect.any(Date),
        updatedById: userId,
      },
    });
    expect(mocks.db.creditTransaction.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.payment.updateMany).not.toHaveBeenCalled();
  });
});
