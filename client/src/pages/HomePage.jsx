import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleHelp, Flame, Library, Plus, SearchX, Sparkles, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { subjectLabel, useApi, useSchools, useSubjects } from '../lib/hooks.js';
import QuestionCard from '../components/QuestionCard.jsx';
import CommunitySidebar from '../components/CommunitySidebar.jsx';
import { Empty, ErrorText, Loading, Tabs } from '../components/ui.jsx';

const SORTS = [['new', 'Шинэ', Sparkles], ['unanswered', 'Хариултгүй', CircleHelp], ['popular', 'Түгээмэл', Flame]];
const TITLES = { new: 'Асуултууд', unanswered: 'Хариулт хүлээж буй асуултууд', popular: 'Түгээмэл асуултууд' };

// P2: Нүүр — асуултын жагсаалт, хайлт (дээд мөрөөс), хичээлээр шүүх, эрэмбэ (FR-07, FR-13)
// ба баруун талын нийгэмлэгийн самбар (FR-31).
export default function HomePage() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const schools = useSchools();
  const { data: stats } = useApi('/stats/community');
  const me = useApi(`/users/${user.id}`);
  const [params, setParams] = useSearchParams();
  const subject = params.get('subject') ?? '';
  const school = params.get('school') ?? '';
  const sort = params.get('sort') ?? 'new';
  const q = (params.get('q') ?? '').trim();

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Шүүлтүүрийг URL-д хадгална: хуудсыг дахин ачаалах, холбоос хуваалцахад хадгалагдана
  const update = (changes) => {
    // Функцээр шинэчилнэ: хайлтын саатсан (debounce) шинэчлэлт сүүлд сонгосон шүүлтүүрийг дарж бичихгүй
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
      return next;
    }, { replace: true });
  };

  const load = async (page) => {
    setLoading(true);
    setError(null);
    try {
      const d = await api('/questions', { params: { q, subject, school, sort, page } });
      setItems((prev) => (page === 1 ? d.questions : [...prev, ...d.questions]));
      setMeta({ page: d.page, total: d.total, pageSize: d.pageSize });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [q, subject, school, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  // Сургууль сонгосон бол хичээлийн жагсаалтыг тэр сургуулийнхаар хязгаарлана
  const subjectOptions = school ? subjects.filter((s) => String(s.schoolId) === school) : subjects;
  const hasMore = items.length < meta.total;
  const firstName = user.name.split(/\s+/)[0];
  const filtered = q || subject || school;
  const noHelpSubjects = me.data && me.data.user.helpSubjects.length === 0;

  return (
    <div className="with-rail">
      <div className="main-pane">
        <header className="page-head home-head">
          <div className="page-head-text">
            <p className="greeting">Сайн уу, {firstName}!</p>
            <h1>{TITLES[sort]}</h1>
          </div>
          <Link to="/questions/new" className="btn btn-primary hide-desktop"><Plus size={16} />Асуух</Link>
        </header>

        <div className="list-toolbar">
          <Tabs variant="segmented" tabs={SORTS} value={sort} onChange={(v) => update({ sort: v === 'new' ? '' : v })} />
          <div className="filter-selects">
            <select aria-label="Бүрэлдэхүүн сургууль" value={school} onChange={(e) => update({ school: e.target.value, subject: '' })}>
              <option value="">Бүх сургууль</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.shortName}</option>)}
            </select>
            <select aria-label="Хичээл" value={subject} onChange={(e) => update({ subject: e.target.value })}>
              <option value="">Бүх хичээл</option>
              {subjectOptions.map((s) => <option key={s.id} value={s.id}>{subjectLabel(s)}</option>)}
            </select>
          </div>
        </div>

        {filtered && !loading && (
          <div className="result-note">
            <span>
              {q ? <>“{q}” гэсэн {meta.total} асуулт олдлоо</> : <>Шүүлтүүрт {meta.total} асуулт тохирлоо</>}
            </span>
            <button className="link-btn" onClick={() => update({ q: '', subject: '', school: '' })}><X size={14} />Цэвэрлэх</button>
          </div>
        )}

        <ErrorText error={error} onRetry={() => load(1)} />

        {loading && items.length === 0 ? <Loading rows={5} /> : (
          !error && items.length === 0 ? (
            q ? (
              <Empty icon={SearchX} title={`“${q}” гэсэн асуулт олдсонгүй`}
                action={<Link to="/questions/new" className="btn btn-primary btn-sm"><Plus size={15} />Энэ асуултыг асуух</Link>}>
                Өөр түлхүүр үгээр хайх эсвэл үгийн эхийг л бичиж үзээрэй.
              </Empty>
            ) : sort === 'unanswered' ? (
              <Empty icon={CircleHelp} title="Хариулт хүлээж буй асуулт алга">Бүх асуулт хариулттай байна.</Empty>
            ) : (
              <Empty title="Одоогоор асуулт алга"
                action={<Link to="/questions/new" className="btn btn-primary btn-sm"><Plus size={15} />Анхны асуултыг асуух</Link>}>
                Ойлгохгүй байгаа зүйлээ асуугаарай. Тухайн хичээлийн туслагчдад мэдэгдэл очно.
              </Empty>
            )
          ) : (
            <ul className="q-list">
              {items.map((item) => <QuestionCard key={item.id} q={item} />)}
            </ul>
          )
        )}

        {hasMore && (
          <button className="btn btn-secondary full load-more" onClick={() => load(meta.page + 1)} disabled={loading}>
            {loading ? 'Ачаалж байна…' : `Цааш үзэх (${meta.total - items.length})`}
          </button>
        )}
      </div>

      <div className="rail">
        {noHelpSubjects && (
          <section className="rail-card onboarding">
            <span className="onb-icon"><Library size={18} /></span>
            <h3>Мэддэг хичээлээрээ бусдад туслаарай</h3>
            <p>Туслах хичээлээ сонговол тэр хичээлийн шинэ асуулт танд мэдэгдлээр ирж, асуугчид таныг туслагчаар санал болгоно.</p>
            <Link to={`/users/${user.id}?edit=1`} className="btn btn-secondary btn-sm">Туслах хичээл сонгох</Link>
          </section>
        )}
        <CommunitySidebar stats={stats} />
      </div>
    </div>
  );
}
