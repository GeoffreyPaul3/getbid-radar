export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_outcomes: {
        Row: {
          buyer_feedback: string | null
          currency: string | null
          disqualification_reason: string | null
          evaluation_score: number | null
          feedback: string | null
          id: string
          lessons_learned: string | null
          loss_reason: string | null
          opportunity_id: string
          our_bid_price: number | null
          our_price: number | null
          recorded_at: string
          recorded_by: string | null
          result: Database["public"]["Enums"]["outcome_result"]
          status: string | null
          updated_at: string | null
          user_score: number | null
          winning_company: string | null
          winning_price: number | null
          workspace_id: string
        }
        Insert: {
          buyer_feedback?: string | null
          currency?: string | null
          disqualification_reason?: string | null
          evaluation_score?: number | null
          feedback?: string | null
          id?: string
          lessons_learned?: string | null
          loss_reason?: string | null
          opportunity_id: string
          our_bid_price?: number | null
          our_price?: number | null
          recorded_at?: string
          recorded_by?: string | null
          result: Database["public"]["Enums"]["outcome_result"]
          status?: string | null
          updated_at?: string | null
          user_score?: number | null
          winning_company?: string | null
          winning_price?: number | null
          workspace_id: string
        }
        Update: {
          buyer_feedback?: string | null
          currency?: string | null
          disqualification_reason?: string | null
          evaluation_score?: number | null
          feedback?: string | null
          id?: string
          lessons_learned?: string | null
          loss_reason?: string | null
          opportunity_id?: string
          our_bid_price?: number | null
          our_price?: number | null
          recorded_at?: string
          recorded_by?: string | null
          result?: Database["public"]["Enums"]["outcome_result"]
          status?: string | null
          updated_at?: string | null
          user_score?: number | null
          winning_company?: string | null
          winning_price?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_outcomes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_outcomes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_tasks: {
        Row: {
          bid_workspace_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          owner_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          requirement_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bid_workspace_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          requirement_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bid_workspace_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          requirement_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_tasks_bid_workspace_id_fkey"
            columns: ["bid_workspace_id"]
            isOneToOne: false
            referencedRelation: "bid_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_tasks_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "opportunity_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_workspaces: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          opportunity_id: string
          owner_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id: string
          owner_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id?: string
          owner_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_workspaces_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_workspaces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_transactions: {
        Row: {
          activated_at: string | null
          amount: number
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          provider_status: string | null
          provider_tx_id: string | null
          status: string
          tx_ref: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          activated_at?: string | null
          amount: number
          created_at?: string
          currency: string
          failure_reason?: string | null
          id?: string
          plan: Database["public"]["Enums"]["plan_tier"]
          provider_status?: string | null
          provider_tx_id?: string | null
          status?: string
          tx_ref: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          activated_at?: string | null
          amount?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider_status?: string | null
          provider_tx_id?: string | null
          status?: string
          tx_ref?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_capabilities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_capabilities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_certifications: {
        Row: {
          created_at: string
          document_id: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_organization: string | null
          kind: string
          name: string
          reference_number: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          kind?: string
          name: string
          reference_number?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          kind?: string
          name?: string
          reference_number?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_certifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profiles: {
        Row: {
          address: string | null
          annual_turnover: number | null
          company_name: string
          country: string | null
          created_at: string
          currency: string
          description: string | null
          employee_count: number | null
          excluded_industries: string[]
          excluded_regions: string[]
          geographic_coverage: string[]
          id: string
          industry: string | null
          legal_name: string | null
          max_contract_value: number | null
          min_contract_value: number | null
          preferred_contract_types: string[]
          preferred_industries: string[]
          preferred_regions: string[]
          updated_at: string
          website: string | null
          workspace_id: string
          years_in_operation: number | null
        }
        Insert: {
          address?: string | null
          annual_turnover?: number | null
          company_name?: string
          country?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          employee_count?: number | null
          excluded_industries?: string[]
          excluded_regions?: string[]
          geographic_coverage?: string[]
          id?: string
          industry?: string | null
          legal_name?: string | null
          max_contract_value?: number | null
          min_contract_value?: number | null
          preferred_contract_types?: string[]
          preferred_industries?: string[]
          preferred_regions?: string[]
          updated_at?: string
          website?: string | null
          workspace_id: string
          years_in_operation?: number | null
        }
        Update: {
          address?: string | null
          annual_turnover?: number | null
          company_name?: string
          country?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          employee_count?: number | null
          excluded_industries?: string[]
          excluded_regions?: string[]
          geographic_coverage?: string[]
          id?: string
          industry?: string | null
          legal_name?: string | null
          max_contract_value?: number | null
          min_contract_value?: number | null
          preferred_contract_types?: string[]
          preferred_industries?: string[]
          preferred_regions?: string[]
          updated_at?: string
          website?: string | null
          workspace_id?: string
          years_in_operation?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_projects: {
        Row: {
          capabilities: string[]
          client: string | null
          contract_value: number | null
          created_at: string
          currency: string
          end_date: string | null
          id: string
          industry: string | null
          location: string | null
          name: string
          reference_contact: string | null
          scope: string | null
          services_delivered: string[]
          start_date: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          capabilities?: string[]
          client?: string | null
          contract_value?: number | null
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          name: string
          reference_contact?: string | null
          scope?: string | null
          services_delivered?: string[]
          start_date?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          capabilities?: string[]
          client?: string | null
          contract_value?: number | null
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          name?: string
          reference_contact?: string | null
          scope?: string | null
          services_delivered?: string[]
          start_date?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_references: {
        Row: {
          client_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          notes: string | null
          project_id: string | null
          workspace_id: string
        }
        Insert: {
          client_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          workspace_id: string
        }
        Update: {
          client_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "company_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_references_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_audits: {
        Row: {
          bid_workspace_id: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          model: string | null
          opportunity_id: string | null
          readiness_score: number | null
          status: Database["public"]["Enums"]["analysis_status"]
          summary: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          bid_workspace_id: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          model?: string | null
          opportunity_id?: string | null
          readiness_score?: number | null
          status?: Database["public"]["Enums"]["analysis_status"]
          summary?: string | null
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          bid_workspace_id?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          model?: string | null
          opportunity_id?: string | null
          readiness_score?: number | null
          status?: Database["public"]["Enums"]["analysis_status"]
          summary?: string | null
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_audits_bid_workspace_id_fkey"
            columns: ["bid_workspace_id"]
            isOneToOne: false
            referencedRelation: "bid_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_audits_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_audits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_findings: {
        Row: {
          audit_id: string
          category: string
          created_at: string
          description: string | null
          evidence: string | null
          id: string
          opportunity_id: string | null
          problem: string | null
          recommendation: string | null
          recommended_fix: string | null
          requirement: string
          resolved: boolean
          severity: Database["public"]["Enums"]["finding_severity"]
          source_reference: string | null
          status: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          audit_id: string
          category?: string
          created_at?: string
          description?: string | null
          evidence?: string | null
          id?: string
          opportunity_id?: string | null
          problem?: string | null
          recommendation?: string | null
          recommended_fix?: string | null
          requirement: string
          resolved?: boolean
          severity: Database["public"]["Enums"]["finding_severity"]
          source_reference?: string | null
          status?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          audit_id?: string
          category?: string
          created_at?: string
          description?: string | null
          evidence?: string | null
          id?: string
          opportunity_id?: string | null
          problem?: string | null
          recommendation?: string | null
          recommended_fix?: string | null
          requirement?: string
          resolved?: boolean
          severity?: Database["public"]["Enums"]["finding_severity"]
          source_reference?: string | null
          status?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_findings_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "compliance_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_findings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_findings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_references: {
        Row: {
          analysis_id: string | null
          certification_id: string | null
          company_project_id: string | null
          created_at: string
          excerpt: string | null
          id: string
          knowledge_document_id: string | null
          label: string
          opportunity_document_id: string | null
          origin: string
          requirement_id: string | null
          source_reference: string | null
          workspace_id: string
        }
        Insert: {
          analysis_id?: string | null
          certification_id?: string | null
          company_project_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          knowledge_document_id?: string | null
          label: string
          opportunity_document_id?: string | null
          origin?: string
          requirement_id?: string | null
          source_reference?: string | null
          workspace_id: string
        }
        Update: {
          analysis_id?: string | null
          certification_id?: string | null
          company_project_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          knowledge_document_id?: string | null
          label?: string
          opportunity_document_id?: string | null
          origin?: string
          requirement_id?: string | null
          source_reference?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_references_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "opportunity_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_references_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "company_certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_references_company_project_id_fkey"
            columns: ["company_project_id"]
            isOneToOne: false
            referencedRelation: "company_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_references_knowledge_document_id_fkey"
            columns: ["knowledge_document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_references_opportunity_document_id_fkey"
            columns: ["opportunity_document_id"]
            isOneToOne: false
            referencedRelation: "opportunity_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_references_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "opportunity_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_references_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          id: string
          page_number: number | null
          section: string | null
          workspace_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          id?: string
          page_number?: number | null
          section?: string | null
          workspace_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          page_number?: number | null
          section?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          category: string
          created_at: string
          error_message: string | null
          extracted_text: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          page_count: number | null
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          error_message?: string | null
          extracted_text?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          page_count?: number | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          category?: string
          created_at?: string
          error_message?: string | null
          extracted_text?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          page_count?: number | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          analysis_error: string | null
          analysis_stage: string | null
          analysis_status: Database["public"]["Enums"]["analysis_status"]
          bid_status: string | null
          buyer: string | null
          buyer_location: string | null
          category: string | null
          contract_value: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          deadline: string | null
          description: string | null
          id: string
          location: string | null
          published_date: string | null
          reminder_24h_sent_at: string | null
          reminder_3d_sent_at: string | null
          reminder_7d_sent_at: string | null
          scope: string | null
          source_type: string
          source_url: string | null
          status: Database["public"]["Enums"]["opportunity_status"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          analysis_error?: string | null
          analysis_stage?: string | null
          analysis_status?: Database["public"]["Enums"]["analysis_status"]
          bid_status?: string | null
          buyer?: string | null
          buyer_location?: string | null
          category?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          location?: string | null
          published_date?: string | null
          reminder_24h_sent_at?: string | null
          reminder_3d_sent_at?: string | null
          reminder_7d_sent_at?: string | null
          scope?: string | null
          source_type?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          analysis_error?: string | null
          analysis_stage?: string | null
          analysis_status?: Database["public"]["Enums"]["analysis_status"]
          bid_status?: string | null
          buyer?: string | null
          buyer_location?: string | null
          category?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          location?: string | null
          published_date?: string | null
          reminder_24h_sent_at?: string | null
          reminder_3d_sent_at?: string | null
          reminder_7d_sent_at?: string | null
          scope?: string | null
          source_type?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_analyses: {
        Row: {
          bidradar_score: number | null
          confidence: number | null
          created_at: string
          critical_blockers: string[]
          engine_version: string | null
          error_message: string | null
          estimated_effort_hours_max: number | null
          estimated_effort_hours_min: number | null
          evaluation_criteria: Json
          evidence_coverage: number | null
          executive_summary: string | null
          human_override: Database["public"]["Enums"]["recommendation"] | null
          human_override_at: string | null
          human_override_by: string | null
          human_override_reason: string | null
          id: string
          inputs_fingerprint: string | null
          missing_evidence: string[]
          model: string | null
          negative_factors: string[]
          open_questions: string[]
          opportunity_id: string
          positive_factors: string[]
          reasoning: string | null
          recommendation: Database["public"]["Enums"]["recommendation"] | null
          recommended_strategy: string | null
          required_actions: string[]
          risks: Json
          status: Database["public"]["Enums"]["analysis_status"]
          strengths: string[]
          updated_at: string
          version: number
          weaknesses: string[]
          winability: string | null
          workspace_id: string
        }
        Insert: {
          bidradar_score?: number | null
          confidence?: number | null
          created_at?: string
          critical_blockers?: string[]
          engine_version?: string | null
          error_message?: string | null
          estimated_effort_hours_max?: number | null
          estimated_effort_hours_min?: number | null
          evaluation_criteria?: Json
          evidence_coverage?: number | null
          executive_summary?: string | null
          human_override?: Database["public"]["Enums"]["recommendation"] | null
          human_override_at?: string | null
          human_override_by?: string | null
          human_override_reason?: string | null
          id?: string
          inputs_fingerprint?: string | null
          missing_evidence?: string[]
          model?: string | null
          negative_factors?: string[]
          open_questions?: string[]
          opportunity_id: string
          positive_factors?: string[]
          reasoning?: string | null
          recommendation?: Database["public"]["Enums"]["recommendation"] | null
          recommended_strategy?: string | null
          required_actions?: string[]
          risks?: Json
          status?: Database["public"]["Enums"]["analysis_status"]
          strengths?: string[]
          updated_at?: string
          version?: number
          weaknesses?: string[]
          winability?: string | null
          workspace_id: string
        }
        Update: {
          bidradar_score?: number | null
          confidence?: number | null
          created_at?: string
          critical_blockers?: string[]
          engine_version?: string | null
          error_message?: string | null
          estimated_effort_hours_max?: number | null
          estimated_effort_hours_min?: number | null
          evaluation_criteria?: Json
          evidence_coverage?: number | null
          executive_summary?: string | null
          human_override?: Database["public"]["Enums"]["recommendation"] | null
          human_override_at?: string | null
          human_override_by?: string | null
          human_override_reason?: string | null
          id?: string
          inputs_fingerprint?: string | null
          missing_evidence?: string[]
          model?: string | null
          negative_factors?: string[]
          open_questions?: string[]
          opportunity_id?: string
          positive_factors?: string[]
          reasoning?: string | null
          recommendation?: Database["public"]["Enums"]["recommendation"] | null
          recommended_strategy?: string | null
          required_actions?: string[]
          risks?: Json
          status?: Database["public"]["Enums"]["analysis_status"]
          strengths?: string[]
          updated_at?: string
          version?: number
          weaknesses?: string[]
          winability?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_analyses_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_analyses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_documents: {
        Row: {
          char_count: number | null
          created_at: string
          error_message: string | null
          extracted_text: string | null
          file_name: string
          file_size: number | null
          id: string
          is_primary: boolean
          mime_type: string | null
          opportunity_id: string
          page_count: number | null
          retrieved_at: string | null
          role: string
          source_url: string | null
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          char_count?: number | null
          created_at?: string
          error_message?: string | null
          extracted_text?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          is_primary?: boolean
          mime_type?: string | null
          opportunity_id: string
          page_count?: number | null
          retrieved_at?: string | null
          role?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          char_count?: number | null
          created_at?: string
          error_message?: string | null
          extracted_text?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          is_primary?: boolean
          mime_type?: string | null
          opportunity_id?: string
          page_count?: number | null
          retrieved_at?: string | null
          role?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_requirements: {
        Row: {
          action_required: string | null
          analysis_version: number | null
          category: string | null
          company_match: string | null
          created_at: string
          due_date: string | null
          evidence: string | null
          evidence_needed: string | null
          extraction_confidence: number | null
          fingerprint: string | null
          human_edited: boolean
          human_note: string | null
          id: string
          importance: string
          is_ambiguous: boolean
          is_mandatory: boolean
          match_confidence: number | null
          opportunity_id: string
          reasoning: string | null
          req_type: Database["public"]["Enums"]["requirement_type"]
          requirement: string
          risk: string | null
          source_document_id: string | null
          source_page: number | null
          source_reference: string | null
          source_section: string | null
          status: Database["public"]["Enums"]["requirement_status"]
          threshold_value: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action_required?: string | null
          analysis_version?: number | null
          category?: string | null
          company_match?: string | null
          created_at?: string
          due_date?: string | null
          evidence?: string | null
          evidence_needed?: string | null
          extraction_confidence?: number | null
          fingerprint?: string | null
          human_edited?: boolean
          human_note?: string | null
          id?: string
          importance?: string
          is_ambiguous?: boolean
          is_mandatory?: boolean
          match_confidence?: number | null
          opportunity_id: string
          reasoning?: string | null
          req_type?: Database["public"]["Enums"]["requirement_type"]
          requirement: string
          risk?: string | null
          source_document_id?: string | null
          source_page?: number | null
          source_reference?: string | null
          source_section?: string | null
          status?: Database["public"]["Enums"]["requirement_status"]
          threshold_value?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action_required?: string | null
          analysis_version?: number | null
          category?: string | null
          company_match?: string | null
          created_at?: string
          due_date?: string | null
          evidence?: string | null
          evidence_needed?: string | null
          extraction_confidence?: number | null
          fingerprint?: string | null
          human_edited?: boolean
          human_note?: string | null
          id?: string
          importance?: string
          is_ambiguous?: boolean
          is_mandatory?: boolean
          match_confidence?: number | null
          opportunity_id?: string
          reasoning?: string | null
          req_type?: Database["public"]["Enums"]["requirement_type"]
          requirement?: string
          risk?: string | null
          source_document_id?: string | null
          source_page?: number | null
          source_reference?: string | null
          source_section?: string | null
          status?: Database["public"]["Enums"]["requirement_status"]
          threshold_value?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_requirements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_requirements_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "opportunity_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_requirements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_platform_admin: boolean
          must_change_password: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_platform_admin?: boolean
          must_change_password?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          must_change_password?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      proposal_documents: {
        Row: {
          bid_workspace_id: string
          completeness_status: string
          content: string
          created_at: string
          created_by: string | null
          evidence_references: Json
          generated_by: string
          id: string
          is_current: boolean
          opportunity_id: string | null
          requirement_ids: string[]
          section_type: string
          title: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          bid_workspace_id: string
          completeness_status?: string
          content?: string
          created_at?: string
          created_by?: string | null
          evidence_references?: Json
          generated_by?: string
          id?: string
          is_current?: boolean
          opportunity_id?: string | null
          requirement_ids?: string[]
          section_type?: string
          title: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          bid_workspace_id?: string
          completeness_status?: string
          content?: string
          created_at?: string
          created_by?: string | null
          evidence_references?: Json
          generated_by?: string
          id?: string
          is_current?: boolean
          opportunity_id?: string | null
          requirement_ids?: string[]
          section_type?: string
          title?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_documents_bid_workspace_id_fkey"
            columns: ["bid_workspace_id"]
            isOneToOne: false
            referencedRelation: "bid_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      score_components: {
        Row: {
          analysis_id: string
          blocking: boolean
          confidence: number | null
          created_at: string
          id: string
          key: string
          label: string
          rationale: string | null
          score: number
          weight: number
          workspace_id: string
        }
        Insert: {
          analysis_id: string
          blocking?: boolean
          confidence?: number | null
          created_at?: string
          id?: string
          key: string
          label: string
          rationale?: string | null
          score: number
          weight: number
          workspace_id: string
        }
        Update: {
          analysis_id?: string
          blocking?: boolean
          confidence?: number | null
          created_at?: string
          id?: string
          key?: string
          label?: string
          rationale?: string | null
          score?: number
          weight?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_components_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "opportunity_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_components_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          bid_price: number | null
          bid_workspace_id: string
          created_at: string
          currency: string | null
          id: string
          notes: string | null
          opportunity_id: string | null
          package_files: Json | null
          reference_number: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submission_method: string | null
          submission_owner_id: string | null
          submitted_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bid_price?: number | null
          bid_workspace_id: string
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          package_files?: Json | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submission_method?: string | null
          submission_owner_id?: string | null
          submitted_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bid_price?: number | null
          bid_workspace_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          package_files?: Json | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submission_method?: string | null
          submission_owner_id?: string | null
          submitted_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_bid_workspace_id_fkey"
            columns: ["bid_workspace_id"]
            isOneToOne: true
            referencedRelation: "bid_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_submission_owner_id_fkey"
            columns: ["submission_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          bio: string | null
          certifications: string[]
          created_at: string
          document_id: string | null
          id: string
          name: string
          role: string | null
          skills: string[]
          workspace_id: string
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          certifications?: string[]
          created_at?: string
          document_id?: string | null
          id?: string
          name: string
          role?: string | null
          skills?: string[]
          workspace_id: string
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          certifications?: string[]
          created_at?: string
          document_id?: string | null
          id?: string
          name?: string
          role?: string | null
          skills?: string[]
          workspace_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          operation: string
          period_end: string | null
          period_start: string | null
          plan: string | null
          resource_id: string | null
          units: number
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          operation: string
          period_end?: string | null
          period_start?: string | null
          plan?: string | null
          resource_id?: string | null
          units?: number
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          operation?: string
          period_end?: string | null
          period_start?: string | null
          plan?: string | null
          resource_id?: string | null
          units?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          temporary_password: string | null
          token: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          temporary_password?: string | null
          token?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          temporary_password?: string | null
          token?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          name: string
          onboarding_completed_at: string | null
          onboarding_step: number
          plan: Database["public"]["Enums"]["plan_tier"]
          renewal_date: string | null
          subscription_started_at: string | null
          subscription_status: string
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          name: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          plan?: Database["public"]["Enums"]["plan_tier"]
          renewal_date?: string | null
          subscription_started_at?: string | null
          subscription_status?: string
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          name?: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          plan?: Database["public"]["Enums"]["plan_tier"]
          renewal_date?: string | null
          subscription_started_at?: string | null
          subscription_status?: string
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation_by_token: {
        Args: {
          _token: string
          _user_id: string
        }
        Returns: Json
      }
      can_admin: { Args: { _ws: string }; Returns: boolean }
      can_write: { Args: { _ws: string }; Returns: boolean }
      get_workspace_member_directory: {
        Args: { _workspace_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_pending: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      is_member: { Args: { _ws: string }; Returns: boolean }
      lookup_invitation_by_token: {
        Args: {
          _token: string
        }
        Returns: {
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by_name: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          workspace_id: string
          workspace_name: string
        }[]
      }
      member_role: {
        Args: { _ws: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      analysis_status: "queued" | "processing" | "completed" | "failed"
      app_role:
        | "owner"
        | "admin"
        | "bid_manager"
        | "contributor"
        | "viewer"
        | "member"
      doc_status: "queued" | "processing" | "completed" | "failed"
      finding_severity:
        | "critical"
        | "warning"
        | "passed"
        | "high"
        | "medium"
        | "low"
      opportunity_status:
        | "new"
        | "analyzing"
        | "analyzed"
        | "reviewing"
        | "pursuing"
        | "no_bid"
        | "preparing"
        | "submitted"
        | "won"
        | "lost"
        | "archived"
      outcome_result: "won" | "lost" | "cancelled" | "disqualified"
      plan_tier: "trial" | "starter" | "growth" | "pro" | "enterprise"
      recommendation: "bid" | "review" | "no_bid"
      requirement_status:
        | "pass"
        | "partial"
        | "missing"
        | "fail"
        | "needs_review"
      requirement_type:
        | "eligibility"
        | "technical"
        | "financial"
        | "experience"
        | "certification"
        | "legal"
        | "documentation"
        | "delivery"
        | "commercial"
      submission_status:
        | "preparing"
        | "ready_for_review"
        | "ready_to_submit"
        | "submitted"
        | "won"
        | "lost"
      task_priority: "low" | "medium" | "high" | "critical"
      task_status: "todo" | "in_progress" | "blocked" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      analysis_status: ["queued", "processing", "completed", "failed"],
      app_role: [
        "owner",
        "admin",
        "bid_manager",
        "contributor",
        "viewer",
        "member",
      ],
      doc_status: ["queued", "processing", "completed", "failed"],
      finding_severity: [
        "critical",
        "warning",
        "passed",
        "high",
        "medium",
        "low",
      ],
      opportunity_status: [
        "new",
        "analyzing",
        "analyzed",
        "reviewing",
        "pursuing",
        "no_bid",
        "preparing",
        "submitted",
        "won",
        "lost",
        "archived",
      ],
      outcome_result: ["won", "lost", "cancelled", "disqualified"],
      plan_tier: ["trial", "starter", "growth", "pro", "enterprise"],
      recommendation: ["bid", "review", "no_bid"],
      requirement_status: [
        "pass",
        "partial",
        "missing",
        "fail",
        "needs_review",
      ],
      requirement_type: [
        "eligibility",
        "technical",
        "financial",
        "experience",
        "certification",
        "legal",
        "documentation",
        "delivery",
        "commercial",
      ],
      submission_status: [
        "preparing",
        "ready_for_review",
        "ready_to_submit",
        "submitted",
        "won",
        "lost",
      ],
      task_priority: ["low", "medium", "high", "critical"],
      task_status: ["todo", "in_progress", "blocked", "completed"],
    },
  },
} as const
