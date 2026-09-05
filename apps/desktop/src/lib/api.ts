import type {
  FindingsPage,
  Project,
  ProjectCreate,
  RiskAssessment,
  Scan,
} from "@codesentinel/shared";

const API_BASE = process.env.NEXT_PUBLIC_CODESENTINEL_API ?? "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (Array.isArray(body.detail)) {
        detail = body.detail.map((d: { msg?: string }) => d.msg ?? "").join("; ");
      } else if (typeof body.detail === "string") {
        detail = body.detail;
      }
    } catch {
      // keep statusText fallback
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => request<{ status: string; database: string }>("/health"),

  listProjects: () => request<Project[]>("/projects"),
  getProject: (id: number) => request<Project>(`/projects/${id}`),
  createProject: (payload: ProjectCreate) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(payload) }),
  deleteProject: (id: number) => request<void>(`/projects/${id}`, { method: "DELETE" }),

  listProjectScans: (projectId: number) => request<Scan[]>(`/projects/${projectId}/scans`),
  getScan: (scanId: number) => request<Scan>(`/scans/${scanId}`),
  createScan: (projectId: number) =>
    request<Scan>(`/projects/${projectId}/scans`, { method: "POST", body: "{}" }),
  getFindings: (scanId: number, opts: { severity?: string; category?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.severity) params.set("severity", opts.severity);
    if (opts.category) params.set("category", opts.category);
    const query = params.toString();
    return request<FindingsPage>(`/scans/${scanId}/findings${query ? `?${query}` : ""}`);
  },
  getAssessment: (scanId: number) => request<RiskAssessment>(`/scans/${scanId}/assessment`),
  getAnalyzers: () =>
    request<{ name: string; description: string; enabled: boolean; status: string }[]>("/analyzers"),
};