-- Migration: 20260909020000_add_member_to_app_role.sql
-- Description: Add 'member' value to public.app_role enum.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'member';
