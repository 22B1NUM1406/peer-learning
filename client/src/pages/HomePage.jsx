import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useDebounced, useSubjects } from '../lib/hooks.js';
import QuestionCard from '../components/QuestionCard.jsx';
import { Empty, ErrorText, Loading, Tabs } from '../components/ui.jsx';

// P2: Нүүр — асуултын жагсаалт, хайлт, хичээлээр шүүх, эрэмбэ (FR-07, FR-13)
export default function HomePage() {
  const subjects = useSubjects();
  const [params, setParams] = useSearchParams();
  const subject = params.get('subject') ?? '';
  const sort = params.get('sort') ?? 'new';
  const [text, setText] = useState(params.get('q') ?? '');
  const q = useDebounced(text.trim(), 350);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Шүүлтүүрийг URL-д хадгална: хуудсыг дахин ачаалах, холбоос хуваалцахад хадгалагдана
  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  useEffect(() => { update({ q }); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async (page) => {
    setLoading(true);
    setError(null);
    try {
      const d = await api('/questions', { params: { q, subject, sort, page } });
      setItems((prev) => (page === 1 ? d.questions : [...prev, ...d.questions]));
      setMeta({ page: d.page, total: d.total, pageSize: d.pageSize });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [q, subject, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMore = items.length < meta.total;

  return (
    <>
      <div className="page-head">
        <h1>Асуултууд</h1>
        <Link to="/questions/new" className="btn btn-primary">Асуулт асуух</Link>
      </div>

      <div className="filters card">
        <input
          type="search" className="search" placeholder="Түлхүүр үгээр хайх…" aria-label="Хайх"
          value={text} onChange={(e) => setText(e.target.value)}
        />
        <select aria-label="Хичээл" value={subject} onChange={(e) => update({ subject: e.target.value })}>
          <option value="">Бүх хичээл</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <Tabs
        tabs={[['new', 'Шинэ'], ['unanswered', 'Хариултгүй']]}
        value={sort}
        onChange={(v) => update({ sort: v === 'new' ? '' : v })}
      />

      <ErrorText error={error} />
      {!loading && items.length === 0 && !error && (
        <Empty>
          {q ? <>“{q}” гэсэн асуулт олдсонгүй. </> : 'Одоогоор асуулт алга. '}
          <Link to="/questions/new">Шинэ асуулт асуух</Link>
        </Empty>
      )}

      <ul className="q-list">
        {items.map((item) => <QuestionCard key={item.id} q={item} />)}
      </ul>

      {loading && <Loading />}
      {hasMore && !loading && (
        <button className="btn btn-ghost full" onClick={() => load(meta.page + 1)}>Цааш үзэх</button>
      )}
    </>
  );
}
