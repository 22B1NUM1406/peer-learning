import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, FolderOpen, Plus } from 'lucide-react';
import { subjectLabel, useApi, useSchools } from '../lib/hooks.js';
import { Empty, ErrorText, Loading, PageHeader } from '../components/ui.jsx';

// Хичээлүүдийн жагсаалт (дээд цэсний "Хичээлүүд", "Материал").
// FR-26: бүрэлдэхүүн сургуулиар бүлэглэж, сургууль ба тэнхимээр шүүнэ.
// Материал хичээл бүрт хадгалагддаг тул ?tab=resources үед карт нь хичээлийн материалын таб руу хөтөлнө.
export default function SubjectsPage() {
  const [params, setParams] = useSearchParams();
  const resources = params.get('tab') === 'resources';
  const school = params.get('school') ?? '';
  const department = params.get('department') ?? '';
  const schools = useSchools();
  const { data, error, loading } = useApi('/subjects', { school, department });

  const setFilter = (changes) => {
    // Функцээр шинэчилнэ: хайлтын саатсан (debounce) шинэчлэлт сүүлд сонгосон шүүлтүүрийг дарж бичихгүй
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
      return next;
    }, { replace: true });
  };
  const departments = schools.find((s) => String(s.id) === school)?.departments ?? [];

  // Сургуулийн дарааллаар бүлэглэнэ; сургууль оноогоогүй хичээл төгсгөлд
  const groups = [];
  const subjects = data?.subjects ?? [];
  for (const s of schools) {
    const items = subjects.filter((x) => x.schoolId === s.id);
    if (items.length) groups.push({ key: s.id, title: s.shortName, full: s.name, items });
  }
  const other = subjects.filter((x) => !x.schoolId);
  if (other.length) groups.push({ key: 'other', title: 'Бусад', full: 'Сургууль заагаагүй хичээл', items: other });

  return (
    <>
      <PageHeader
        title={resources ? 'Материал' : 'Хичээлүүд'}
        sub={resources
          ? 'Материалыг хичээлээр нь хадгалдаг. Хичээлээ сонгож лекц, бие даалтын материалыг үзээрэй.'
          : 'Хичээлээ сонгож асуулт, материал, туслах боломжтой оюутнуудыг үзээрэй.'}
        actions={resources
          ? <Link to="/resources/new" className="btn btn-primary"><Plus size={16} />Материал хуваалцах</Link>
          : <Link to="/questions/new" className="btn btn-primary"><Plus size={16} />Асуулт асуух</Link>}
      />

      <div className="filter-row">
        <select aria-label="Бүрэлдэхүүн сургууль" value={school} onChange={(e) => setFilter({ school: e.target.value, department: '' })}>
          <option value="">Бүх бүрэлдэхүүн сургууль</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.shortName} — {s.name}</option>)}
        </select>
        {departments.length > 0 && (
          <select aria-label="Тэнхим" value={department} onChange={(e) => setFilter({ department: e.target.value })}>
            <option value="">Бүх тэнхим</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
      </div>

      {loading && !data && <Loading rows={4} />}
      <ErrorText error={error} />
      {data && subjects.length === 0 && (
        <Empty title="Тохирох хичээл алга" action={<Link to="/questions/new" className="btn btn-secondary btn-sm">Асуулт асуухдаа шинэ хичээл нэмэх</Link>}>
          Энэ сургууль, тэнхимд хичээл бүртгэгдээгүй байна.
        </Empty>
      )}
      {groups.map((g) => (
        <section key={g.key} className="school-group">
          <h2>{g.title}<span className="school-full">{g.full}</span><span className="school-count">{g.items.length}</span></h2>
          <ul className="subject-grid">
            {g.items.map((s) => (
              <li key={s.id}>
                <Link to={resources ? `/subjects/${s.id}?tab=resources` : `/subjects/${s.id}`} className="subject-card">
                  <span className="subject-icon">{resources ? <FolderOpen size={17} /> : <BookOpen size={17} />}</span>
                  <span className="grow subject-card-text">
                    <span className="subject-name">{s.code && <span className="subject-code">{s.code}</span>}{s.name}</span>
                    {s.departmentName && <span className="subject-dept">{s.departmentName}</span>}
                  </span>
                  <span className={`subject-qcount ${s.questionCount ? '' : 'zero'}`} title="Асуултын тоо">{s.questionCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
