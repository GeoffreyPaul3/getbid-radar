import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "./auth-context";
import { calculateProfileCompleteness } from "./profile-utils";

type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
type WorkspaceMember = Database["public"]["Tables"]["workspace_members"]["Row"];
type CompanyProfile = Database["public"]["Tables"]["company_profiles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

interface WorkspaceContextType {
  workspace: Workspace | null;
  allWorkspaces: Workspace[];
  member: WorkspaceMember | null;
  role: AppRole | null;
  companyProfile: CompanyProfile | null;
  isLoading: boolean;
  isOnboarded: boolean;
  completenessScore: number;
  refetchWorkspace: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspace: null,
  allWorkspaces: [],
  member: null,
  role: null,
  companyProfile: null,
  isLoading: true,
  isOnboarded: false,
  completenessScore: 0,
  refetchWorkspace: async () => {},
  switchWorkspace: async () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [member, setMember] = useState<WorkspaceMember | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkspaceData = useCallback(
    async (preferredWorkspaceId?: string) => {
      if (!user) {
        setWorkspace(null);
        setAllWorkspaces([]);
        setMember(null);
        setCompanyProfile(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 1. Fetch workspaces the user is already a registered member of
        const { data: memberRows, error: memberErr } = await supabase
          .from("workspace_members")
          .select("*, workspaces(*)")
          .eq("user_id", user.id);

        if (memberErr) {
          console.warn("[Workspace] Membership fetch error:", memberErr.message);
        }

        const workspacesList = (memberRows ?? [])
          .map((m) => m.workspaces as unknown as Workspace)
          .filter(Boolean);

        if (workspacesList.length > 0) {
          setAllWorkspaces(workspacesList);
          const targetWs = preferredWorkspaceId
            ? (workspacesList.find((w) => w.id === preferredWorkspaceId) ?? workspacesList[0]!)
            : workspacesList[0]!;

          const activeMember = memberRows?.find((m) => m.workspace_id === targetWs.id) ?? null;

          const { data: profileRow } = await supabase
            .from("company_profiles")
            .select("*")
            .eq("workspace_id", targetWs.id)
            .maybeSingle();

          setWorkspace(targetWs);
          setMember(activeMember);
          setCompanyProfile(profileRow ?? null);
          setIsLoading(false);
          return;
        }

        // 2. If not a member of any workspace yet, check if a workspace was created by this user
        const { data: createdWorkspaces } = await supabase
          .from("workspaces")
          .select("*")
          .eq("created_by", user.id)
          .limit(1);

        let targetWs: Workspace | null = createdWorkspaces?.[0] || null;
        const orgName = (user.user_metadata?.["company_name"] as string) || "My Organization";

        if (!targetWs) {
          const newWsId = crypto.randomUUID();
          const { data: createdWs, error: createWsErr } = await supabase
            .from("workspaces")
            .insert({
              id: newWsId,
              name: orgName,
              created_by: user.id,
              onboarding_step: 1,
            })
            .select()
            .maybeSingle();

          if (createWsErr) {
            console.warn("[Workspace] Workspace create warning:", createWsErr.message);
            // Construct in-memory fallback so user is never blocked
            targetWs = {
              id: newWsId,
              name: orgName,
              created_by: user.id,
              plan: "trial",
              subscription_status: "trialing",
              trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
              current_period_start: null,
              current_period_end: null,
              subscription_started_at: null,
              renewal_date: null,
              cancelled_at: null,
              onboarding_step: 1,
              onboarding_completed_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          } else if (createdWs) {
            targetWs = createdWs;
          }
        }

        if (targetWs) {
          // Ensure membership entry
          const { data: newMember } = await supabase
            .from("workspace_members")
            .upsert(
              {
                workspace_id: targetWs.id,
                user_id: user.id,
                role: "owner",
              },
              { onConflict: "workspace_id,user_id" },
            )
            .select()
            .maybeSingle();

          // Ensure company profile entry
          let { data: cp } = await supabase
            .from("company_profiles")
            .select("*")
            .eq("workspace_id", targetWs.id)
            .maybeSingle();

          if (!cp) {
            const { data: createdCp } = await supabase
              .from("company_profiles")
              .insert({
                workspace_id: targetWs.id,
                company_name: orgName,
              })
              .select()
              .maybeSingle();
            cp = createdCp;
          }

          setWorkspace(targetWs);
          setAllWorkspaces([targetWs]);
          setMember(newMember ?? null);
          setCompanyProfile(cp ?? null);
        }
      } catch (err) {
        console.error("[Workspace] Error resolving workspace data:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!authLoading) {
      fetchWorkspaceData();
    }
  }, [authLoading, fetchWorkspaceData]);

  const activeWorkspaceIdRef = React.useRef<string | undefined>(workspace?.id);
  useEffect(() => {
    activeWorkspaceIdRef.current = workspace?.id;
  }, [workspace?.id]);

  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      await fetchWorkspaceData(workspaceId);
    },
    [fetchWorkspaceData],
  );

  const refetchWorkspace = useCallback(async () => {
    await fetchWorkspaceData(activeWorkspaceIdRef.current);
  }, [fetchWorkspaceData]);

  const isOnboarded = Boolean(workspace?.onboarding_completed_at);
  const completenessScore = calculateProfileCompleteness(companyProfile);

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        allWorkspaces,
        member,
        role: member?.role ?? null,
        companyProfile,
        isLoading: authLoading || isLoading,
        isOnboarded,
        completenessScore,
        refetchWorkspace,
        switchWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
