async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function apiGet<T>(path: string): Promise<T> {
  return fetch(path).then((res) => handle<T>(res));
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then((res) => handle<T>(res));
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((res) => handle<T>(res));
}

export function apiDelete(path: string): Promise<void> {
  return fetch(path, { method: "DELETE" }).then((res) => handle<void>(res));
}

export function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return fetch(path, { method: "POST", body: formData }).then((res) => handle<T>(res));
}
