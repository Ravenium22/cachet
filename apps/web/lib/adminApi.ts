const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api-production-d6be.up.railway.app";

class AdminApiClient {
  private getSecret(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("adminSecret");
  }

  setSecret(secret: string) {
    localStorage.setItem("adminSecret", secret);
  }

  clearSecret() {
    localStorage.removeItem("adminSecret");
  }

  hasSecret(): boolean {
    return !!this.getSecret();
  }

  async fetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const secret = this.getSecret();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> ?? {}),
    };
    if (secret) headers["Authorization"] = `Admin ${secret}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401 || res.status === 403) {
      this.clearSecret();
      if (typeof window !== "undefined") window.location.reload();
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(body.error ?? "Request failed");
    }

    const json = await res.json();
    return json.data;
  }
}

export const adminApi = new AdminApiClient();
