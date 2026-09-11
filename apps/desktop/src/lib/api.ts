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
  listAllFindings: (
    opts: {
      scanId?: number;
      projectId?: number;
      severity?: string;
      category?: string;
      search?: string;
      limit?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    if (opts.scanId) params.set("scan_id", String(opts.scanId));
    if (opts.projectId) params.set("project_id", String(opts.projectId));
    if (opts.severity) params.set("severity", opts.severity);
    if (opts.category) params.set("category", opts.category);
    if (opts.search) params.set("search", opts.search);
    if (opts.limit) params.set("limit", String(opts.limit));
    const query = params.toString();
    return request<FindingsPage>(`/findings${query ? `?${query}` : ""}`);
  },
  getAssessment: (scanId: number) => request<RiskAssessment>(`/scans/${scanId}/assessment`),
  getAnalyzers: () =>
    request<{ name: string; description: string; enabled: boolean; status: string }[]>("/analyzers"),
  getAIStatus: () =>
    request<{
      opencode: {
        available: boolean;
        path: string | null;
        version: string | null;
        description: string;
      };
      agy: {
        available: boolean;
        path: string | null;
        version: string | null;
        description: string;
      };
    }>("/ai/status"),
  runAIScan: (projectId: number, payload: { provider: string; prompt?: string }) =>
    request<Scan>(`/projects/${projectId}/ai-scan`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getScanComparison: (scanId: number) =>
    request<{
      static_scan_id?: number | null;
      ai_scan_id?: number | null;
      metrics: {
        total_static: number;
        total_ai: number;
        corroborated_count: number;
        ai_only_count: number;
        static_only_count: number;
        overlap_percentage: number;
        ai_discovery_percentage: number;
      };
      executive_summary: string;
      corroborated: Array<{
        static: any;
        ai: any;
        agreement: string;
        file: string;
        line?: number | null;
      }>;
      ai_only: any[];
      static_only: any[];
    }>(`/scans/${scanId}/comparison`),
  compareScans: (projectId: number, staticScanId: number, aiScanId: number) =>
    request<{
      static_scan_id?: number | null;
      ai_scan_id?: number | null;
      metrics: {
        total_static: number;
        total_ai: number;
        corroborated_count: number;
        ai_only_count: number;
        static_only_count: number;
        overlap_percentage: number;
        ai_discovery_percentage: number;
      };
      executive_summary: string;
      corroborated: Array<{
        static: any;
        ai: any;
        agreement: string;
        file: string;
        line?: number | null;
      }>;
      ai_only: any[];
      static_only: any[];
    }>(`/projects/${projectId}/scan-comparison?static_scan_id=${staticScanId}&ai_scan_id=${aiScanId}`),
};