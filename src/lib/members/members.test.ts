/**
 * Workspace member management tests.
 *
 * Tests focus on business logic: authorization, role validation,
 * sole-owner protection, and invitation lifecycle.
 *
 * The fake Supabase client is extended to handle `rpc` and `ilike`
 * calls that the members.server module uses.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  inviteWorkspaceMember,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  type AppRole,
} from "./members.server";

// ────────────────────────────────────────────────────────────────
// Mock email sender — must not be called with passwords
// ────────────────────────────────────────────────────────────────

vi.mock("../email/resend.server", () => ({
  sendMemberInvitationEmail: vi.fn().mockResolvedValue({ ok: true }),
}));

// ────────────────────────────────────────────────────────────────
// Minimal fake Supabase builder for members tests
// ────────────────────────────────────────────────────────────────

type FakeRow = any;

class MembersTestDb {
  private _tables: Record<string, FakeRow[]>;
  calls: Array<{ table: string; op: string }> = [];

  constructor(tables: Record<string, FakeRow[]> = {}) {
    this._tables = { ...tables };
  }

  rows(table: string) {
    return this._tables[table] ?? [];
  }

  from(table: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const db = this;
    const filters: Array<[string, unknown]> = [];
    let ilikePair: [string, string] | null = null;
    let op = "select";
    let payload: any = null;
    let onConflictCols: string[] = [];
    let singleMode: "one" | "maybe" | null = null;
    let countMode = false;

    const q: any = {
      select(_cols?: string, opts?: any) {
        if (opts?.count) countMode = true;
        return q;
      },
      insert(p: any) {
        op = "insert";
        payload = p;
        return q;
      },
      update(p: any) {
        op = "update";
        payload = p;
        return q;
      },
      upsert(p: any, opts?: { onConflict?: string }) {
        op = "upsert";
        payload = p;
        onConflictCols = (opts?.onConflict ?? "id").split(",").map((c: string) => c.trim());
        return q;
      },
      delete() {
        op = "delete";
        return q;
      },
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return q;
      },
      ilike(col: string, pattern: string) {
        ilikePair = [col, pattern];
        return q;
      },
      single() {
        singleMode = "one";
        return q;
      },
      maybeSingle() {
        singleMode = "maybe";
        return q;
      },

      then(onfulfilled: any, onrejected: any) {
        db.calls.push({ table, op });
        const tableRows: FakeRow[] = (db._tables[table] ??= []);

        const matches = (row: FakeRow) => {
          const filterPass = filters.every(([c, v]) => row[c] === v);
          if (!filterPass) return false;
          if (ilikePair) {
            const [col, pattern] = ilikePair;
            const raw = (pattern as string).replace(/%/g, "");
            return String(row[col]).toLowerCase() === raw.toLowerCase();
          }
          return true;
        };

        let result: FakeRow[] = [];
        const error: any = null;

        if (op === "insert") {
          const rows = Array.isArray(payload) ? payload : [payload];
          for (const r of rows) {
            const rec = {
              id: `gen-${Date.now()}-${Math.random().toFixed(6)}`,
              created_at: new Date().toISOString(),
              ...r,
            };
            tableRows.push(rec);
            result.push(rec);
          }
        } else if (op === "upsert") {
          const rows = Array.isArray(payload) ? payload : [payload];
          for (const r of rows) {
            const existing = tableRows.find((row) => onConflictCols.every((c) => row[c] === r[c]));
            if (existing) {
              Object.assign(existing, r);
              result.push(existing);
            } else {
              const rec = { id: `gen-${Date.now()}`, created_at: new Date().toISOString(), ...r };
              tableRows.push(rec);
              result.push(rec);
            }
          }
        } else if (op === "update") {
          result = tableRows.filter(matches);
          for (const row of result) Object.assign(row, payload);
        } else if (op === "delete") {
          result = tableRows.filter(matches);
          db._tables[table] = tableRows.filter((r) => !matches(r));
        } else {
          result = tableRows.filter(matches);
        }

        if (countMode) {
          return Promise.resolve({ data: result, error, count: result.length }).then(
            onfulfilled,
            onrejected,
          );
        }

        if (singleMode === "one") {
          if (result.length === 0)
            return Promise.resolve({ data: null, error: { message: "No rows found" } }).then(
              onfulfilled,
              onrejected,
            );
          return Promise.resolve({ data: { ...result[0] }, error: null }).then(
            onfulfilled,
            onrejected,
          );
        }
        if (singleMode === "maybe") {
          return Promise.resolve({ data: result[0] ? { ...result[0] } : null, error: null }).then(
            onfulfilled,
            onrejected,
          );
        }

        return Promise.resolve({ data: result.map((r) => ({ ...r })), error }).then(
          onfulfilled,
          onrejected,
        );
      },
    };

    // rpc is handled separately
    return q;
  }

  rpc(_fn: string, _args: any) {
    return Promise.resolve({ data: [], error: null });
  }

  client(): any {
    return this as any;
  }
}

// ────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────

const WS_ID = "ws-00000001";
const CALLER_ID = "user-00000001";
const TARGET_ID = "user-00000002";
const MEM_RECORD_ID = "memrec-00000001";

const buildDb = (overrides: Record<string, FakeRow[]> = {}) => {
  return new MembersTestDb({
    workspace_members: [
      { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "owner" },
    ],
    workspaces: [{ id: WS_ID, name: "Test Workspace" }],
    profiles: [],
    workspace_invitations: [],
    ...overrides,
  });
};

// ────────────────────────────────────────────────────────────────
// inviteWorkspaceMember
// ────────────────────────────────────────────────────────────────

describe("inviteWorkspaceMember", () => {
  it("throws when caller is not a member", async () => {
    const db = new MembersTestDb({
      workspace_members: [], // caller has no membership
      workspaces: [{ id: WS_ID, name: "Test Workspace" }],
      profiles: [],
      workspace_invitations: [],
    });

    await expect(
      inviteWorkspaceMember(db.client(), {
        workspaceId: WS_ID,
        callerUserId: CALLER_ID,
        email: "alice@example.com",
        fullName: "Alice",
        role: "member",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("throws when caller is only a viewer (not owner/admin)", async () => {
    const db = new MembersTestDb({
      workspace_members: [{ id: "m1", workspace_id: WS_ID, user_id: CALLER_ID, role: "viewer" }],
      workspaces: [{ id: WS_ID, name: "Test Workspace" }],
      profiles: [],
      workspace_invitations: [],
    });

    await expect(
      inviteWorkspaceMember(db.client(), {
        workspaceId: WS_ID,
        callerUserId: CALLER_ID,
        email: "alice@example.com",
        fullName: "Alice",
        role: "member",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("throws for invalid role", async () => {
    const db = buildDb();
    await expect(
      inviteWorkspaceMember(db.client(), {
        workspaceId: WS_ID,
        callerUserId: CALLER_ID,
        email: "alice@example.com",
        fullName: "Alice",
        role: "superadmin" as AppRole,
      }),
    ).rejects.toThrow("Invalid role");
  });

  it("throws for invalid email", async () => {
    const db = buildDb();
    await expect(
      inviteWorkspaceMember(db.client(), {
        workspaceId: WS_ID,
        callerUserId: CALLER_ID,
        email: "not-an-email",
        fullName: "Alice",
        role: "member",
      }),
    ).rejects.toThrow("valid email");
  });

  it("creates an invitation record for a new user", async () => {
    const db = buildDb();
    const result = await inviteWorkspaceMember(db.client(), {
      workspaceId: WS_ID,
      callerUserId: CALLER_ID,
      email: "newuser@example.com",
      fullName: "New User",
      role: "member",
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("newuser@example.com");

    const invitations = db.rows("workspace_invitations");
    expect(invitations.length).toBe(1);
    expect(invitations[0]!.email).toBe("newuser@example.com");
    expect(invitations[0]!.role).toBe("member");
    expect(invitations[0]!.workspace_id).toBe(WS_ID);
  });

  it("directly adds an existing registered user to workspace", async () => {
    const EXISTING_USER_ID = "user-existing-00001";
    const db = new MembersTestDb({
      workspace_members: [
        { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "owner" },
      ],
      workspaces: [{ id: WS_ID, name: "Test Workspace" }],
      profiles: [
        { id: EXISTING_USER_ID, email: "existing@example.com", full_name: "Existing User" },
      ],
      workspace_invitations: [],
    });

    const result = await inviteWorkspaceMember(db.client(), {
      workspaceId: WS_ID,
      callerUserId: CALLER_ID,
      email: "existing@example.com",
      fullName: "Existing User",
      role: "viewer",
    });

    expect(result.ok).toBe(true);
    const members = db.rows("workspace_members");
    // Should have 2: original owner + new member
    expect(members.length).toBe(2);
    expect(members.some((m) => m.user_id === EXISTING_USER_ID && m.role === "viewer")).toBe(true);
  });

  it("throws when existing user is already a member", async () => {
    const EXISTING_USER_ID = "user-existing-00001";
    const db = new MembersTestDb({
      workspace_members: [
        { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "owner" },
        { id: "mem-existing", workspace_id: WS_ID, user_id: EXISTING_USER_ID, role: "member" },
      ],
      workspaces: [{ id: WS_ID, name: "Test Workspace" }],
      profiles: [
        { id: EXISTING_USER_ID, email: "existing@example.com", full_name: "Existing User" },
      ],
      workspace_invitations: [],
    });

    await expect(
      inviteWorkspaceMember(db.client(), {
        workspaceId: WS_ID,
        callerUserId: CALLER_ID,
        email: "existing@example.com",
        fullName: "Existing User",
        role: "viewer",
      }),
    ).rejects.toThrow("already an active member");
  });

  it("never generates or includes passwords in invitation", async () => {
    const { sendMemberInvitationEmail } = await import("../email/resend.server");
    const mockFn = sendMemberInvitationEmail as ReturnType<typeof vi.fn>;
    mockFn.mockClear();

    const db = buildDb();
    await inviteWorkspaceMember(db.client(), {
      workspaceId: WS_ID,
      callerUserId: CALLER_ID,
      email: "newmember@example.com",
      fullName: "New Member",
      role: "member",
    });

    expect(mockFn).toHaveBeenCalledOnce();
    const call = mockFn.mock.calls[0]![0];
    // Must NOT contain any password field
    expect(call).not.toHaveProperty("password");
    expect(call).not.toHaveProperty("temporaryPassword");
    expect(call).not.toHaveProperty("plaintext");
  });
});

// ────────────────────────────────────────────────────────────────
// updateWorkspaceMemberRole
// ────────────────────────────────────────────────────────────────

describe("updateWorkspaceMemberRole", () => {
  it("throws when caller lacks authorization", async () => {
    const db = new MembersTestDb({
      workspace_members: [
        { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "member" },
        { id: "target-rec", workspace_id: WS_ID, user_id: TARGET_ID, role: "viewer" },
      ],
    });

    await expect(
      updateWorkspaceMemberRole(db.client(), {
        workspaceId: WS_ID,
        callerUserId: CALLER_ID,
        targetMemberId: "target-rec",
        newRole: "admin",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("updates role successfully when caller is owner", async () => {
    const db = new MembersTestDb({
      workspace_members: [
        { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "owner" },
        { id: "target-rec", workspace_id: WS_ID, user_id: TARGET_ID, role: "viewer" },
      ],
    });

    const result = await updateWorkspaceMemberRole(db.client(), {
      workspaceId: WS_ID,
      callerUserId: CALLER_ID,
      targetMemberId: "target-rec",
      newRole: "admin",
    });

    expect(result.ok).toBe(true);
    const members = db.rows("workspace_members");
    expect(members.find((m) => m.id === "target-rec")?.role).toBe("admin");
  });

  it("prevents demoting the last owner", async () => {
    const db = new MembersTestDb({
      workspace_members: [
        { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "owner" },
        // Only one owner
      ],
    });

    await expect(
      updateWorkspaceMemberRole(db.client(), {
        workspaceId: WS_ID,
        callerUserId: CALLER_ID,
        targetMemberId: MEM_RECORD_ID,
        newRole: "admin",
      }),
    ).rejects.toThrow("retain at least one owner");
  });

  it("allows demoting an owner when there are 2+ owners", async () => {
    const SECOND_OWNER_REC = "owner-rec-2";
    const db = new MembersTestDb({
      workspace_members: [
        { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "owner" },
        { id: SECOND_OWNER_REC, workspace_id: WS_ID, user_id: TARGET_ID, role: "owner" },
      ],
    });

    const result = await updateWorkspaceMemberRole(db.client(), {
      workspaceId: WS_ID,
      callerUserId: CALLER_ID,
      targetMemberId: SECOND_OWNER_REC,
      newRole: "admin",
    });

    expect(result.ok).toBe(true);
  });

  it("throws for an invalid role value", async () => {
    const db = buildDb();
    await expect(
      updateWorkspaceMemberRole(db.client(), {
        workspaceId: WS_ID,
        callerUserId: CALLER_ID,
        targetMemberId: MEM_RECORD_ID,
        newRole: "god" as AppRole,
      }),
    ).rejects.toThrow("Invalid role");
  });
});

// ────────────────────────────────────────────────────────────────
// removeWorkspaceMember
// ────────────────────────────────────────────────────────────────

describe("removeWorkspaceMember", () => {
  it("throws when caller is not authorized", async () => {
    const db = new MembersTestDb({
      workspace_members: [
        { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "viewer" },
        { id: "target-rec", workspace_id: WS_ID, user_id: TARGET_ID, role: "member" },
      ],
    });

    await expect(
      removeWorkspaceMember(db.client(), {
        workspaceId: WS_ID,
        callerUserId: CALLER_ID,
        targetMemberId: "target-rec",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("removes a member successfully", async () => {
    const db = new MembersTestDb({
      workspace_members: [
        { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "owner" },
        { id: "target-rec", workspace_id: WS_ID, user_id: TARGET_ID, role: "member" },
      ],
    });

    const result = await removeWorkspaceMember(db.client(), {
      workspaceId: WS_ID,
      callerUserId: CALLER_ID,
      targetMemberId: "target-rec",
    });

    expect(result.ok).toBe(true);
    const members = db.rows("workspace_members");
    expect(members.find((m) => m.id === "target-rec")).toBeUndefined();
  });

  it("prevents removing the last owner", async () => {
    const db = new MembersTestDb({
      workspace_members: [
        { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "owner" },
        // Only one owner, so self-removal (if trying to remove the owner record) should fail
      ],
    });

    await expect(
      removeWorkspaceMember(db.client(), {
        workspaceId: WS_ID,
        callerUserId: CALLER_ID,
        targetMemberId: MEM_RECORD_ID,
      }),
    ).rejects.toThrow("retain at least one owner");
  });

  it("throws when member not found in workspace", async () => {
    const db = buildDb();

    await expect(
      removeWorkspaceMember(db.client(), {
        workspaceId: WS_ID,
        callerUserId: CALLER_ID,
        targetMemberId: "non-existent-id",
      }),
    ).rejects.toThrow("Member not found");
  });
});

// ────────────────────────────────────────────────────────────────
// revokeWorkspaceInvitation
// ────────────────────────────────────────────────────────────────

describe("revokeWorkspaceInvitation", () => {
  it("throws when caller is not authorized", async () => {
    const db = new MembersTestDb({
      workspace_members: [
        { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "viewer" },
      ],
      workspace_invitations: [{ id: "inv-001", workspace_id: WS_ID, email: "pending@example.com" }],
    });

    await expect(
      revokeWorkspaceInvitation(db.client(), {
        workspaceId: WS_ID,
        callerUserId: CALLER_ID,
        invitationId: "inv-001",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("deletes the invitation record when authorized", async () => {
    const db = new MembersTestDb({
      workspace_members: [
        { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "owner" },
      ],
      workspace_invitations: [{ id: "inv-001", workspace_id: WS_ID, email: "pending@example.com" }],
    });

    const result = await revokeWorkspaceInvitation(db.client(), {
      workspaceId: WS_ID,
      callerUserId: CALLER_ID,
      invitationId: "inv-001",
    });

    expect(result.ok).toBe(true);
    const invitations = db.rows("workspace_invitations");
    expect(invitations.find((i) => i.id === "inv-001")).toBeUndefined();
  });

  it("admin can also revoke invitations", async () => {
    const db = new MembersTestDb({
      workspace_members: [
        { id: MEM_RECORD_ID, workspace_id: WS_ID, user_id: CALLER_ID, role: "admin" },
      ],
      workspace_invitations: [{ id: "inv-002", workspace_id: WS_ID, email: "another@example.com" }],
    });

    const result = await revokeWorkspaceInvitation(db.client(), {
      workspaceId: WS_ID,
      callerUserId: CALLER_ID,
      invitationId: "inv-002",
    });

    expect(result.ok).toBe(true);
  });
});
