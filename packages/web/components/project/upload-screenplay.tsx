'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/fetch';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, FileText, X } from 'lucide-react';

const ACCEPTED_EXTENSIONS = '.txt,.md,.docx,.pdf,.fountain,.fdx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadScreenplayProps {
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
}

export function UploadScreenplay({
  name,
  onNameChange,
  description,
  onDescriptionChange,
}: UploadScreenplayProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(
    (selectedFile: File) => {
      const ext = selectedFile.name.slice(selectedFile.name.lastIndexOf('.')).toLowerCase();
      if (!['.txt', '.md', '.docx', '.pdf', '.fountain', '.fdx'].includes(ext)) {
        toast.error('Unsupported file type. Please upload a .pdf, .fdx, .fountain, .docx, .md, or .txt file.');
        return;
      }
      if (selectedFile.size > MAX_FILE_SIZE) {
        toast.error('File too large. Maximum size is 10MB.');
        return;
      }
      setFile(selectedFile);
      // Auto-fill project name from filename if empty
      if (!name.trim()) {
        const dot = selectedFile.name.lastIndexOf('.');
        onNameChange(dot > 0 ? selectedFile.name.slice(0, dot) : selectedFile.name);
      }
    },
    [name, onNameChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFile(selectedFile);
    },
    [handleFile]
  );

  const clearFile = useCallback(() => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (name.trim()) formData.append('name', name.trim());
      if (description.trim()) formData.append('description', description.trim());

      const response = await apiFetch('/api/projects/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to upload file';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // Non-JSON response (e.g. 413 from reverse proxy before handler runs)
          if (response.status === 413) {
            errorMessage = 'File too large. Please use a file under 10MB.';
          } else if (response.status === 403) {
            errorMessage = 'Request blocked — please refresh the page and try again.';
          } else if (response.status === 429) {
            errorMessage = 'Too many uploads. Please wait a moment and try again.';
          } else {
            errorMessage = `Upload failed (${response.status}). Please try again.`;
          }
        }
        toast.error(errorMessage);
        setUploading(false);
        return;
      }

      const data = await response.json();
      toast.success('Project created!');
      router.push(`/projects/${data.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file';
      toast.error(message);
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        data-testid="drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-3 p-8
          border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
              : 'border-muted-foreground/25 hover:border-blue-400 hover:bg-muted/50'
          }
        `}
      >
        <Upload className="w-8 h-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Drop your screenplay here or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Final Draft (.fdx) · Fountain (.fountain) · PDF · Word · Markdown · Plain text
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Max 10 MB — native formats give the best parse results
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleInputChange}
          onClick={(e) => e.stopPropagation()}
          className="hidden"
          data-testid="file-input"
        />
      </div>

      {/* Selected file info */}
      {file && (
        <div
          data-testid="file-info"
          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
        >
          <FileText className="w-5 h-5 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
            data-testid="clear-file"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Name & description (shared with parent but rendered here for upload tab context) */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="upload-name">Project Name *</Label>
          <Input
            id="upload-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            placeholder="My Screenplay"
            className="h-11"
            data-testid="upload-project-name-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="upload-description">Description</Label>
          <Input
            id="upload-description"
            type="text"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="A short description"
            className="h-11"
            data-testid="upload-project-description-input"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-border">
        <Button
          type="button"
          disabled={uploading || !file || !name.trim()}
          onClick={handleUpload}
          className="brand-gradient brand-gradient-hover"
          data-testid="upload-button"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload &amp; Create Project
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
