const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-production-d6be.up.railway.app";

interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
}

/** Decode a JWT payload without verification (client-side only). */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

class ApiClient {
  /** Mutex: only one refresh request can be in-flight at a time. */
  private refreshPromise: Promise<boolean> | null = null;

  private getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("accessToken");
  }

  private getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refreshToken");
  }

  private setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  }

  clearTokens() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  getUsername(): string | null {
    const token = this.getAccessToken();
    if (!token) return null;
    const payload = decodeJwtPayload(token) as { username?: string } | null;
    return payload?.username ?? null;
  }

  /**
   * Returns true if the access token will expire within the given
   * number of seconds (default 120s = 2 minutes).
   */
  isTokenExpiringSoon(thresholdSeconds = 120): boolean {
    const token = this.getAccessToken();
    if (!token) return true;
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return false; // can't tell — assume fine
    return payload.exp * 1000 - Date.now() < thresholdSeconds * 1000;
  }

  getLoginUrl(): string {
    return `${API_BASE}/api/v1/auth/discord`;
  }

  async request<T = unknown>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    // Proactively refresh if token is about to expire
    if (this.isTokenExpiringSoon() && this.getRefreshToken()) {
      await this.refreshTokensDedup();
    }

    const token = this.getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> ?? {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    // If 401, try to refresh (deduped)
    if (res.status === 401 && this.getRefreshToken()) {
      const refreshed = await this.refreshTokensDedup();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.getAccessToken()}`;
        res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      } else {
        this.clearTokens();
        if (typeof window !== "undefined") window.location.href = "/";
        throw new ApiError(401, "Session expired");
      }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Request failed" }));
      throw new ApiError(res.status, body.error ?? "Request failed");
    }

    return res.json() as Promise<ApiResponse<T>>;
  }

  /** Convenience: returns just the data field. */
  async fetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await this.request<T>(path, options);
    return res.data;
  }

  /**
   * Deduplicates concurrent refresh calls.
   * If a refresh is already in-flight, all callers await the same promise.
   */
  private async refreshTokensDedup(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refreshTokens().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async refreshTokens(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;

      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>;
      this.setTokens(data.data.accessToken, data.data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = new ApiClient();
