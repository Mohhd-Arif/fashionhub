export async function api(path, options = {}) {
  const { body, ...rest } = options;
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin', ...rest,
    headers: { 'X-Requested-With': 'FashionHub', ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
    ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || 'Cannot reach the server. Please try again.');
    error.status = response.status;
    throw error;
  }
  if (response.status !== 204 && !data) throw new Error('The API is unavailable. Please check that the backend is running.');
  return data;
}
