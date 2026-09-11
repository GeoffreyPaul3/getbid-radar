import React, { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Search,
  ShieldCheck,
  ShieldOff,
  Loader2,
  AlertCircle,
  RefreshCw,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAdminUsersFn,
  toggleUserAdminStatusFn,
  type AdminUserRecord,
} from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminUsersFn({ data: { adminUserId: user.id } });
      setUsers(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load users.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleAdmin = async (targetUser: AdminUserRecord, makeAdmin: boolean) => {
    if (!user?.id) return;
    setTogglingId(targetUser.id);
    try {
      await toggleUserAdminStatusFn({
        data: {
          adminUserId: user.id,
          targetUserId: targetUser.id,
          makeAdmin,
        },
      });
      toast.success(
        makeAdmin
          ? `${targetUser.full_name || targetUser.email} is now a platform operator.`
          : `Platform operator privileges removed.`
      );
      await fetchUsers();
    } catch (err) {
      toast.error("Action failed", { description: (err as Error).message });
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q)
    );
  });

  const adminCount = users.filter((u) => u.is_platform_admin).length;

  return (
    <AdminShell
      title="Users & Operators"
      description="All registered platform users and platform operator access control."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-border bg-surface shadow-subtle p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Total Users</span>
              <div className="p-2 rounded-lg bg-primary-soft text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="font-display font-extrabold text-2xl text-foreground">{users.length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Registered profiles</p>
          </Card>
          <Card className="border border-border bg-surface shadow-subtle p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Platform Operators</span>
              <div className="p-2 rounded-lg bg-primary-soft text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="font-display font-extrabold text-2xl text-foreground">{adminCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">With operator privileges</p>
          </Card>
          <Card className="border border-border bg-surface shadow-subtle p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Standard Users</span>
              <div className="p-2 rounded-lg bg-primary-soft text-primary">
                <User className="h-4 w-4" />
              </div>
            </div>
            <div className="font-display font-extrabold text-2xl text-foreground">{users.length - adminCount}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Workspace-scoped accounts</p>
          </Card>
        </div>

        <Card className="border border-border bg-surface shadow-subtle">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold">All Users</CardTitle>
              <CardDescription className="text-xs">Manage platform users and operator privileges.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="admin-users-search"
                  placeholder="Search name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-56"
                />
              </div>
              <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="text-xs h-8">
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /><span className="text-xs">Loading users...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-xs text-destructive flex items-center justify-between">
                <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>
                <Button size="sm" variant="outline" onClick={fetchUsers} className="text-xs">Retry</Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                {search ? `No users match "${search}".` : "No users registered yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Email</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Joined</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filtered.map((u) => {
                      const isSelf = u.id === user?.id;
                      const isToggling = togglingId === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-surface-muted/40 transition-colors">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt={u.full_name || "User"} className="h-8 w-8 rounded-full object-cover border border-border/60 shrink-0" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-primary-soft text-primary font-mono text-xs font-bold flex items-center justify-center border border-primary/20 shrink-0">
                                  {(u.full_name || u.email || "U").slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <p className="font-semibold text-foreground">
                                {u.full_name || "—"}
                                {isSelf && <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">(you)</span>}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-mono text-[11px] text-muted-foreground">{u.email || "—"}</td>
                          <td className="py-3 pr-4">
                            {u.is_platform_admin ? (
                              <Badge className="text-[10px] font-mono bg-primary/10 text-primary border-primary/30 border">
                                <ShieldCheck className="h-3 w-3 mr-1" />Operator
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">User</Badge>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="py-3 text-right">
                            {u.is_platform_admin ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={isToggling || isSelf} title={isSelf ? "Cannot revoke your own privileges" : ""}>
                                    {isToggling ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ShieldOff className="h-3 w-3 mr-1" />Revoke</>}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Revoke operator access?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {u.full_name || u.email} will lose platform operator access immediately. Their workspace account remains active.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleToggleAdmin(u, false)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Revoke Access</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="text-xs h-7" disabled={isToggling}>
                                    {isToggling ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ShieldCheck className="h-3 w-3 mr-1" />Grant Operator</>}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Grant platform operator access?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {u.full_name || u.email} will gain full platform operator access including all workspaces, revenue data, and plan overrides. Only grant to trusted team members.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleToggleAdmin(u, true)}>Grant Operator Access</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
