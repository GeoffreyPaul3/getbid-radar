import { supabase } from "@/integrations/supabase/client";

export const ALLOWED_AVATAR_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface AvatarUploadResult {
  success: boolean;
  avatarUrl?: string;
  error?: string;
}

/**
 * Validates and uploads a user avatar image to Supabase Storage,
 * then updates the user's profile row with the new avatar URL.
 */
export async function uploadUserAvatar(
  userId: string,
  file: File
): Promise<AvatarUploadResult> {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  if (!ALLOWED_AVATAR_MIMES.includes(file.type)) {
    return {
      success: false,
      error: "Invalid file format. Please upload a JPEG, PNG, or WebP image.",
    };
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return {
      success: false,
      error: "File size exceeds 5 MB. Please select a smaller image.",
    };
  }

  try {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    // Update profiles table
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Broadcast update event
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("profile:avatar-updated", {
          detail: { avatarUrl: publicUrl },
        })
      );
    }

    return { success: true, avatarUrl: publicUrl };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || "An error occurred during upload.",
    };
  }
}

/**
 * Removes a user's avatar from their profile.
 */
export async function removeUserAvatar(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }

  try {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("profile:avatar-updated", {
          detail: { avatarUrl: null },
        })
      );
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || "Failed to remove avatar.",
    };
  }
}
