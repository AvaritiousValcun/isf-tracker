import { supabase } from "./supabase";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(
    options.headers
  );

  headers.set("Content-Type", "application/json");

  if (session?.access_token) {
    headers.set(
      "Authorization",
      `Bearer ${session.access_token}`
    );
  }

  const response = await fetch(
    `/api${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      error: text || "Unknown server error",
    };
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data as T;
}