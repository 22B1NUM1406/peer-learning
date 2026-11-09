import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleHelp, Flame, Plus, Search, Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useDebounced, useSubjects } from '../lib/hooks.js';
import QuestionCard from '../components/QuestionCard.jsx';
import CommunitySidebar from '../components/CommunitySidebar.jsx';
import { Empty, ErrorText, Loading, Tabs } from '../components/ui.jsx';

const SORTS = [['new', 'Шинэ', Sparkles], ['unanswered', 'Хариултгүй', CircleHelp], ['popular', 'Түгээмэл', Flame]];

// P2: Нүүр — угтах хэсэг, асуултын жагсаалт, хайлт, хичээлээр шүүх, эрэмбэ (FR-07, FR-13)
// ба баруун талын нийгэмлэгийн самбар.
export default function HomePage() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const { data: stats } = useApi('/stats/community');
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
  const firstName = user.name.split(/\s+/)[0];
  const totals = stats?.totals;

  return (
    <div className="with-sidebar">
      <div>
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">Сайн уу, {firstName}!</h1>
          <p>Ойлгохгүй байгаа зүйлээ асуу, мэддэг зүйлээ тайлбарлаж бусдад туслаарай.</p>
          <div className="hero-search">
            <label className="search-box">
              <Search size={19} />
              <input
                type="search" placeholder="Асуулт хайх: түлхүүр үг, сэдэв…" aria-label="Хайх"
                value={text} onChange={(e) => setText(e.target.value)}
              />
            </label>
            <Link to="/questions/new" className="btn btn-light"><Plus size={18} />Асуулт асуух</Link>
          </div>
          {totals && (
            <div className="hero-stats" aria-label="Системийн нийт тоо">
              <span><strong>{totals.questions}</strong>асуулт</span>
              <span><strong>{totals.answers}</strong>хариулт</span>
              <span><strong>{totals.acceptedQuestions}</strong>тусалсан хариулттай асуулт</span>
              <span><strong>{totals.students}</strong>оюутан</span>
            </div>
          )}
        </section>

        <div className="list-toolbar">
          <Tabs
            variant="segmented"
            tabs={SORTS}
            value={sort}
            onChange={(v) => update({ sort: v === 'new' ? '' : v })}
          />
          <select aria-label="Хичээл" value={subject} onChange={(e) => update({ subject: e.target.value })}>
            <option value="">Бүх хичээл</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {q && !loading && <p className="result-note">“{q}” — {meta.total} асуулт олдлоо</p>}

        <ErrorText error={error} />
        {!loading && items.length === 0 && !error && (
          <Empty>
            {q ? <>“{q}” гэсэн асуулт олдсонгүй. </> : sort === 'unanswered' ? 'Хариултгүй асуулт алга. ' : 'Одоогоор асуулт алга. '}
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
      </div>

      <CommunitySidebar stats={stats} />
    </div>
  );
}
