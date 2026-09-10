import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Search,
  Download,
  Edit2,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAdminCompaniesFn,
  updateCompanyPlanOverrideFn,
  type AdminCompanyRecord,
} from "@/lib/admin/admin.functions";
import type { PlanTier } from "@/lib/billing/plans";

export const Route = createFileRoute("/admin/companies")({
  component: AdminCompaniesPage,
});

function AdminCompaniesPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<AdminCompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [editWorkspace, setEditWorkspace] = useState<AdminCompanyRecord | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>("starter");
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchCompanies = () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    getAdminCompaniesFn({ data: { adminUserId: user.id } })
      .then((data) => setCompanies(data))
      .catch((err) => setError(err.message || "Failed to load companies."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCompanies();
  }, [user?.id]);

  const handleUpdatePlan = async () => {
    if (!user?.id || !editWorkspace) return;
    setIsUpdating(true);

    try {
      await updateCompanyPlanOverrideFn({
        data: {
          adminUserId: user.id,
          workspaceId: editWorkspace.id,
          plan: selectedPlan,
          subscriptionStatus: selectedStatus,
        },
      });

      toast.success("Workspace plan updated successfully");
      setEditWorkspace(null);
      fetchCompanies();
    } catch (err) {
      toast.error("Failed to update workspace", {
        description: (err as Error).message,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const exportCSV = () => {
    if (!companies.length) return;
    const headers = ["ID", "Name", "Plan", "Status", "Members", "Tenders", "Created At"];
    const rows = filteredCompanies.map((c) => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      c.plan,
      c.subscription_status,
      c.member_count,
      c.opportunity_count,
      c.created_at,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `getbidradar-companies-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.plan.toLowerCase().includes(search.toLowerCase()) ||
    c.subscription_status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminShell
      title="Companies & Workspace Management"
      description="Inspect tenant organizations, manage subscription tiers, and audit workspace capacity."
    >
      <div className="space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={!companies.length}
            className="text-xs w-full sm:w-auto"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>

        {/* Table Card */}
        <Card className="border border-border bg-surface shadow-subtle overflow-hidden">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>All Workspaces ({filteredCompanies.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-xs gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span>Loading workspaces...</span>
              </div>
            ) : error ? (
              <div className="p-6 text-xs text-destructive flex items-center justify-between">
                <span>{error}</span>
                <Button size="sm" variant="outline" onClick={fetchCompanies}>
                  Retry
                </Button>
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
                No companies found matching your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted/50 border-b border-border/80 text-muted-foreground font-mono uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Workspace Name</th>
                      <th className="py-3 px-4 font-semibold">Plan Tier</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-center">Members</th>
                      <th className="py-3 px-4 font-semibold text-center">Tenders</th>
                      <th className="py-3 px-4 font-semibold">Created</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredCompanies.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-muted/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {c.name}
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize font-mono font-medium text-foreground">
                            {c.plan}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-mono ${
                              c.subscription_status === "active"
                                ? "border-bid text-bid"
                                : "border-muted-foreground/40 text-muted-foreground"
                            }`}
                          >
                            {c.subscription_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {c.member_count}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {c.opportunity_count}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setEditWorkspace(c);
                              setSelectedPlan((c.plan as PlanTier) || "starter");
                              setSelectedStatus(c.subscription_status || "active");
                            }}
                          >
                            <Edit2 className="h-3 w-3 mr-1" /> Edit Plan
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Override Dialog */}
      <Dialog open={Boolean(editWorkspace)} onOpenChange={(open) => !open && setEditWorkspace(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Modify Workspace Plan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Override the subscription tier or status for <strong>{editWorkspace?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Subscription Tier</label>
              <Select value={selectedPlan} onValueChange={(v: any) => setSelectedPlan(v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial (14-Day Evaluation)</SelectItem>
                  <SelectItem value="starter">Starter Plan</SelectItem>
                  <SelectItem value="growth">Growth Plan</SelectItem>
                  <SelectItem value="pro">Pro Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Subscription Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditWorkspace(null)}
              disabled={isUpdating}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleUpdatePlan}
              disabled={isUpdating}
              className="text-xs font-semibold"
            >
              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
