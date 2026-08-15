"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { SourceType } from "@codesentinel/shared";
import { FolderPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
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

const SOURCE_OPTIONS: { value: SourceType; label: string; hint: string }[] = [
  { value: "local", label: "Local project", hint: "Absolute path to a directory on this machine" },
  { value: "github", label: "GitHub repository", hint: "Cloned to a managed workspace (over HTTPS)" },
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
        <Button>
          <FolderPlus className="h-4 w-4" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Local-first: source code is analyzed on your machine. GitHub URLs are cloned locally.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                placeholder="e.g. my-web-app"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Source</Label>
              <div className="grid grid-cols-2 gap-2">
                {SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSourceType(option.value)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      sourceType === option.value
                        ? "border-primary bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="path-or-url">
                {sourceType === "local" ? "Local path" : "Repository URL"}
              </Label>
              <Input
                id="path-or-url"
                required
                placeholder={
                  sourceType === "local" ? "/home/you/code/my-app" : "https://github.com/org/repo"
                }
                value={pathOrUrl}
                onChange={(e) => setPathOrUrl(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="What is this project?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}