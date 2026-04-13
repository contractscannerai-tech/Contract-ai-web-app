const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function apiRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  return response;
}

export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const res = await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as { success?: boolean; message?: string; error?: string };
  if (!res.ok) return { success: false, error: data.message ?? data.error ?? "Login failed" };
  return { success: true };
}

export async function signup(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const res = await apiRequest("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as { success?: boolean; message?: string; error?: string };
  if (!res.ok) return { success: false, error: data.message ?? data.error ?? "Signup failed" };
  return { success: true };
}
