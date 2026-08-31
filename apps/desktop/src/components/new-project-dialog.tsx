"use client";

import { useState } from "react";
import { toast } from "sonner";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { SourceType } from "@codesentinel/shared";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const SOURCE_OPTIONS: { value: SourceType; label: string; hint: string; icon: string }[] = [
  { value: "local", label: "Local Project", hint: "Absolute path to a directory on this machine", icon: "folder_open" },
  { value: "github", label: "GitHub Repository", hint: "Cloned to a managed workspace (over HTTPS)", icon: "code" },
];

export function NewProjectDialog({
  onCreated,
  trigger,
}: {
  onCreated: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("local");
  const [pathOrUrl, setPathOrUrl] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload =
        sourceType === "local"
          ? { name, description: description || null, source_type: "local" as SourceType, local_path: pathOrUrl }
          : {
              name,
              description: description || null,
              source_type: "github" as SourceType,
              repo_url: pathOrUrl,
            };
      await api.createProject(payload);
      toast.success("Project created successfully");
      setOpen(false);
      setName("");
      setDescription("");
      setPathOrUrl("");
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not create project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button className="bg-primary hover:bg-primary/90 text-on-primary font-semibold text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-all cyber-glow cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Project
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-on-surface font-[Inter]">New Project</DialogTitle>
            <DialogDescription className="text-sm text-on-surface-variant font-[Inter] mt-1">
              Local-first: source code is analyzed securely on your machine.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Project Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-[0.08em]">
                Project Name <span className="text-error">*</span>
              </Label>
              <Input
                id="name"
                required
                placeholder="e.g. payments-api"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background border border-outline-variant rounded-lg px-3.5 py-2 text-sm text-on-background placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>

            {/* Source Type Selector */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-[0.08em]">
                Source Type
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {SOURCE_OPTIONS.map((option) => {
                  const isSelected = sourceType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSourceType(option.value)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-all cursor-pointer flex flex-col justify-between gap-1",
                        isSelected
                          ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(208,188,255,0.12)] ring-1 ring-primary"
                          : "border-outline-variant bg-surface-container/60 hover:bg-surface-container hover:border-outline"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "material-symbols-outlined text-[18px]",
                            isSelected ? "text-primary" : "text-on-surface-variant"
                          )}
                          style={{ fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          {option.icon}
                        </span>
                        <span className={cn("text-xs font-semibold", isSelected ? "text-primary" : "text-on-surface")}>
                          {option.label}
                        </span>
                      </div>
                      <span className="text-[11px] leading-tight text-on-surface-variant line-clamp-2">
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Path or URL */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="path-or-url" className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-[0.08em]">
                {sourceType === "local" ? "Local Directory Path" : "GitHub Repository URL"} <span className="text-error">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="path-or-url"
                  required
                  placeholder={sourceType === "local" ? "/home/user/projects/my-app" : "https://github.com/organization/repo"}
                  value={pathOrUrl}
                  onChange={(e) => setPathOrUrl(e.target.value)}
                  className="flex-1 bg-background border border-outline-variant rounded-lg px-3.5 py-2 text-sm text-on-background placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-[JetBrains_Mono]"
                />
                {sourceType === "local" && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const selected = await openDialog({
                          directory: true,
                          multiple: false,
                        });
                        if (selected && typeof selected === "string") {
                          setPathOrUrl(selected);
                        }
                      } catch (err) {
                        console.error("Failed to open dialog", err);
                      }
                    }}
                    className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-colors text-on-surface flex items-center shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1">folder</span>
                    Browse
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description" className="text-[11px] font-bold text-on-surface-variant font-[JetBrains_Mono] uppercase tracking-[0.08em]">
                Description <span className="text-on-surface-variant/50 normal-case font-normal">(optional)</span>
              </Label>
              <Input
                id="description"
                placeholder="Brief description of this target..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background border border-outline-variant rounded-lg px-3.5 py-2 text-sm text-on-background placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>

          <DialogFooter className="mt-2 flex items-center justify-end gap-3 border-t border-outline-variant/60 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-transparent border border-outline-variant text-on-surface font-semibold text-xs px-4 py-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-on-primary font-semibold text-xs px-5 py-2 rounded-lg hover:bg-primary/90 transition-all cyber-glow disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  <span>Creating…</span>
                </>
              ) : (
                "Create Project"
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
