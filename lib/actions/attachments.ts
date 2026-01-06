"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface Attachment {
  id: string;
  entity_type: string;
  entity_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
}

/**
 * Upload a file to Supabase storage and create attachment record
 * Path structure: location_id/entity_type/entity_id/filename
 */
export async function uploadAttachment(
  formData: FormData,
  entityType: string,
  entityId: string,
  locationId: string
) {
  try {
    const supabase = createServiceClient();
    const file = formData.get("file") as File;

    if (!file) {
      return { success: false, error: "No file provided" };
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return { success: false, error: "File size must be less than 50MB" };
    }

    // Generate unique filename to avoid conflicts
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${timestamp}_${sanitizedName}`;
    
    // Organize by location: location_id/entity_type/entity_id/filename
    const filePath = `${locationId}/${entityType}/${entityId}/${uniqueFileName}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return { success: false, error: uploadError.message };
    }

    // Create attachment record
    const { data: attachment, error: dbError } = await supabase
      .from("attachments")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file if DB insert fails
      await supabase.storage.from("documents").remove([filePath]);
      console.error("DB insert error:", dbError);
      return { success: false, error: dbError.message };
    }

    revalidatePath("/admin/bills");
    return { success: true, data: attachment };
  } catch (error) {
    console.error("Upload attachment error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to upload file" 
    };
  }
}

/**
 * Get all attachments for an entity
 */
export async function getAttachments(entityType: string, entityId: string) {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Get attachments error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Attachment[] };
  } catch (error) {
    console.error("Get attachments error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get attachments" 
    };
  }
}

/**
 * Get a signed URL for viewing/downloading a file
 */
export async function getAttachmentUrl(attachmentId: string) {
  try {
    const supabase = createServiceClient();

    // Get attachment record
    const { data: attachment, error: attachmentError } = await supabase
      .from("attachments")
      .select("file_path")
      .eq("id", attachmentId)
      .single();

    if (attachmentError || !attachment) {
      return { success: false, error: "Attachment not found" };
    }

    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(attachment.file_path, 3600);

    if (error) {
      console.error("Get signed URL error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, url: data.signedUrl };
  } catch (error) {
    console.error("Get attachment URL error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get file URL" 
    };
  }
}

/**
 * Delete an attachment (both record and file)
 */
export async function deleteAttachment(attachmentId: string) {
  try {
    const supabase = createServiceClient();

    // Get attachment to get file path
    const { data: attachment, error: getError } = await supabase
      .from("attachments")
      .select("file_path, entity_type, entity_id")
      .eq("id", attachmentId)
      .single();

    if (getError || !attachment) {
      return { success: false, error: "Attachment not found" };
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([attachment.file_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    // Delete record from database
    const { error: dbError } = await supabase
      .from("attachments")
      .delete()
      .eq("id", attachmentId);

    if (dbError) {
      console.error("DB delete error:", dbError);
      return { success: false, error: dbError.message };
    }

    revalidatePath("/admin/bills");
    return { success: true };
  } catch (error) {
    console.error("Delete attachment error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to delete file" 
    };
  }
}

/**
 * Get attachment count for an entity (for displaying indicator)
 */
export async function getAttachmentCount(entityType: string, entityId: string) {
  try {
    const supabase = createServiceClient();

    const { count, error } = await supabase
      .from("attachments")
      .select("*", { count: "exact", head: true })
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);

    if (error) {
      console.error("Get attachment count error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, count: count || 0 };
  } catch (error) {
    console.error("Get attachment count error:", error);
    return { success: false, count: 0 };
  }
}

