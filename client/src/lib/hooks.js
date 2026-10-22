import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Өгөгдөл ачаалах энгийн hook: { data, error, loading, reload }
export function useApi(path, params) {
  const key = path ? `${path}?${JSON.stringify(params ?? {})}` : null;
  const [state, setState] = useState({ data: null, error: null, loading: !!path });

  const load = useCallback(() => {
    if (!path) return Promise.resolve();
    setState((s) => ({ ...s, loading: true, error: null }));
    return api(path, { params })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

// Идэвхтэй хичээлүүд (олон хуудсанд сонголт болгон хэрэгтэй)
export function useSubjects() {
  const { data } = useApi('/subjects');
  return data?.subjects ?? [];
}

// Бичих бүрд биш, зогссоны дараа (ms) утгыг шинэчилнэ: ижил асуулт, хайлтад
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
