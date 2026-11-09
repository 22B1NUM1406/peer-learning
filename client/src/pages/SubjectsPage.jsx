import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, FolderOpen, Plus } from 'lucide-react';
import { useApi } from '../lib/hooks.js';
import { Empty, ErrorText, Loading } from '../components/ui.jsx';

// Хичээлүүдийн жагсаалт (дээд цэсний "Хичээлүүд", "Материал").
// Материал хичээл бүрт хадгалагддаг тул ?tab=resources үед карт нь хичээлийн материалын таб руу хөтөлнө.
export default function SubjectsPage() {
  const [params] = useSearchParams();
  const resources = params.get('tab') === 'resources';
  const { data, error, loading } = useApi('/subjects');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{resources ? 'Материал' : 'Хичээлүүд'}</h1>
          <p className="muted no-top">
            {resources
              ? 'Материалыг хичээлээр нь хадгалдаг. Хичээлээ сонгож лекц, бие даалтын материалыг үзээрэй.'
              : 'Хичээлээ сонгож асуулт, материал, туслах боломжтой оюутнуудыг үзээрэй.'}
          </p>
        </div>
        {resources
          ? <Link to="/resources/new" className="btn btn-primary"><Plus size={17} />Материал хуваалцах</Link>
          : <Link to="/questions/new" className="btn btn-primary"><Plus size={17} />Асуулт асуух</Link>}
      </div>

      {loading && <Loading />}
      <ErrorText error={error} />
      {data?.subjects.length === 0 && <Empty>Одоогоор хичээл бүртгэгдээгүй байна.</Empty>}
      <ul className="subject-grid">
        {data?.subjects.map((s) => (
          <li key={s.id}>
            <Link to={resources ? `/subjects/${s.id}?tab=resources` : `/subjects/${s.id}`} className="card subject-card">
              <span className="subject-icon">{resources ? <FolderOpen size={20} /> : <BookOpen size={20} />}</span>
              <span className="grow">
                <span className="strong">{s.name}</span>
                <span className="muted small">{s.questionCount} асуулт</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
