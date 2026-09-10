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
