"use client";

import { useState } from "react";
import { toast } from "sonner";
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

export function NewProjectDialog({ onCreated }: { onCreated: () => void }) {
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
      toast.success("Project created");
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
        <button className="bg-primary hover:bg-primary-container text-on-primary font-title-sm text-title-sm px-md py-2 rounded-lg flex items-center gap-sm transition-all cyber-glow">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Project
        </button>
      </DialogTrigger>
      <DialogContent className="bg-card border border-outline-variant max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-headline-md text-headline-md text-on-surface">New Project</DialogTitle>
            <DialogDescription className="font-body-sm text-body-sm text-on-surface-variant">
              Local-first: source code is analyzed on your machine. GitHub URLs are cloned locally.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="font-label-caps text-label-caps text-on-surface-variant uppercase">Name</Label>
              <Input
                id="name"
                required
                placeholder="e.g. my-web-app"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all text-on-background placeholder:text-on-surface-variant"
              />
            </div>

            <div className="grid gap-2">
              <Label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Source</Label>
              <div className="grid grid-cols-2 gap-2">
                {SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSourceType(option.value)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      sourceType === option.value
                        ? "border-primary bg-primary/10"
                        : "hover:bg-surface-container-highest"
                    )}
                  >
                    <div className="flex items-center gap-sm mb-1">
                      <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{option.icon}</span>
                      <span className="block font-medium text-on-surface">{option.label}</span>
                    </div>
                    <span className="block text-xs text-on-surface-variant font-body-sm">{option.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="path-or-url" className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                {sourceType === "local" ? "Local path" : "Repository URL"}
              </Label>
              <Input
                id="path-or-url"
                required
                placeholder={sourceType === "local" ? "/home/you/code/my-app" : "https://github.com/org/repo"}
                value={pathOrUrl}
                onChange={(e) => setPathOrUrl(e.target.value)}
                className="bg-background border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all text-on-background placeholder:text-on-surface-variant"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className="font-label-caps text-label-caps text-on-surface-variant uppercase">Description (optional)</Label>
              <Input
                id="description"
                placeholder="What is this project?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all text-on-background placeholder:text-on-surface-variant"
              />
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-transparent border border-outline-variant text-on-surface font-label-caps text-label-caps px-md py-sm rounded hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-on-primary font-label-caps text-label-caps px-md py-sm rounded hover:bg-primary-container transition-all cyber-glow disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create Project"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
