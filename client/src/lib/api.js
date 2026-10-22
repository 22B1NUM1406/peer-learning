// Бүх API дуудлага энэ функцээр дамжина.
// Монолит тул хаяг нь харьцангуй ('/api/...'); cookie автоматаар явна.

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// body нь объект бол JSON, FormData бол (файл байршуулах) тэр чигээр нь илгээнэ
export async function api(path, { method = 'GET', body, params } = {}) {
  let url = `/api${path}`;
  if (params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    if (qs.toString()) url += `?${qs}`;
  }
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.error ?? {};
    throw new ApiError(res.status, err.code, err.message ?? 'Алдаа гарлаа');
  }
  return data;
}
