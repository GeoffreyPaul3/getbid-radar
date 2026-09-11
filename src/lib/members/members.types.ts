export type AppRole = "owner" | "admin" | "member" | "viewer";

export interface WorkspaceMemberRecord {
  id: string;
  userId: string | null;
  role: AppRole;
  createdAt: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  isPending: boolean;
}

export interface InviteMemberResult {
  ok: boolean;
  message: string;
  invitationId?: string;
  temporaryPassword?: string;
}

export interface InvitationDetails {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  fullName: string;
  role: AppRole;
  status: string;
  expiresAt: string;
  invitedByName: string;
  isExpired: boolean;
  isAccepted: boolean;
}

