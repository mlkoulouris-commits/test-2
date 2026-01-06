"use client";

import { useState, useEffect } from "react";
import { FileText, Image as ImageIcon, Download, Trash2, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  getAttachments, 
  deleteAttachment,
  type Attachment 
} from "@/lib/actions/attachments";
import { toast } from "sonner";
import { FilePreviewDialog } from "./file-preview-dialog";

interface AttachmentsListProps {
  entityType: string;
  entityId: string;
  refreshTrigger?: number;
}

export function AttachmentsList({ entityType, entityId, refreshTrigger }: AttachmentsListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<Attachment | null>(null);

  const loadAttachments = async () => {
    setIsLoading(true);
    const result = await getAttachments(entityType, entityId);
    
    if (result.success && result.data) {
      setAttachments(result.data);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    loadAttachments();
  }, [entityType, entityId, refreshTrigger]);

  const handleDelete = (attachment: Attachment) => {
    setAttachmentToDelete(attachment);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!attachmentToDelete) return;

    setDeletingId(attachmentToDelete.id);
    setDeleteConfirmOpen(false);
    
    const result = await deleteAttachment(attachmentToDelete.id);

    if (result.success) {
      toast.success("File deleted successfully");
      loadAttachments();
    } else {
      toast.error(result.error || "Failed to delete file");
    }

    setDeletingId(null);
    setAttachmentToDelete(null);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    }
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No files attached</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <Card key={attachment.id} className="p-3">
            <div className="flex items-center gap-3">
              {getFileIcon(attachment.file_type)}
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.file_size)} • {formatDate(attachment.uploaded_at)}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewAttachment(attachment)}
                  title="Preview"
                >
                  <Eye className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const { getAttachmentUrl } = await import("@/lib/actions/attachments");
                    const result = await getAttachmentUrl(attachment.id);
                    if (result.success && result.url) {
                      window.open(result.url, "_blank");
                    } else {
                      toast.error("Failed to download file");
                    }
                  }}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(attachment)}
                  disabled={deletingId === attachment.id}
                  title="Delete"
                >
                  {deletingId === attachment.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {previewAttachment && (
        <FilePreviewDialog
          attachment={previewAttachment}
          open={!!previewAttachment}
          onOpenChange={(open) => !open && setPreviewAttachment(null)}
        />
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{attachmentToDelete?.file_name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

