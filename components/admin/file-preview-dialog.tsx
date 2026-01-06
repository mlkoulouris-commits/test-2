"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ExternalLink } from "lucide-react";
import { getAttachmentUrl, type Attachment } from "@/lib/actions/attachments";
import { toast } from "sonner";

interface FilePreviewDialogProps {
  attachment: Attachment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewDialog({ attachment, open, onOpenChange }: FilePreviewDialogProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && attachment) {
      loadFileUrl();
    }
    
    return () => {
      setFileUrl(null);
      setIsLoading(true);
    };
  }, [open, attachment]);

  const loadFileUrl = async () => {
    setIsLoading(true);
    const result = await getAttachmentUrl(attachment.id);
    
    if (result.success && result.url) {
      setFileUrl(result.url);
    } else {
      toast.error("Failed to load file");
      onOpenChange(false);
    }
    
    setIsLoading(false);
  };

  const isPDF = attachment.file_type === "application/pdf";
  const isImage = attachment.file_type.startsWith("image/");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-4">{attachment.file_name}</DialogTitle>
            <div className="flex items-center gap-2">
              {fileUrl && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(fileUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = fileUrl;
                      link.download = attachment.file_name;
                      link.click();
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto border rounded-lg bg-muted/30">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {isPDF && fileUrl && (
                <iframe
                  src={fileUrl}
                  className="w-full h-full min-h-[600px]"
                  title={attachment.file_name}
                />
              )}

              {isImage && fileUrl && (
                <div className="flex items-center justify-center p-4">
                  <img
                    src={fileUrl}
                    alt={attachment.file_name}
                    className="max-w-full max-h-[70vh] object-contain rounded"
                  />
                </div>
              )}

              {!isPDF && !isImage && fileUrl && (
                <div className="flex flex-col items-center justify-center h-96 space-y-4">
                  <p className="text-muted-foreground">
                    Preview not available for this file type
                  </p>
                  <Button onClick={() => window.open(fileUrl, "_blank")}>
                    <Download className="h-4 w-4 mr-2" />
                    Download to view
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

