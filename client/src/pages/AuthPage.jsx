import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

// P1: Нэвтрэх / Бүртгэл (FR-01, FR-02, UC-01). Нэг маягт, хоёр таб.
export default function AuthPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate('/'); // UC-01 (4): нүүр хуудас руу
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (m) => { setMode(m); setError(''); };

  return (
    <div className="auth-wrap">
      <section className="auth-intro" aria-label="Системийн тухай">
        <span className="brand-mark auth-mark" aria-hidden="true"><GraduationCap size={22} /></span>
        <h1 className="auth-title">Хичээлээ бие биедээ асууж, тайлбарлаж суралцъя</h1>
        <ul className="auth-points">
          <li><strong>Асуу.</strong> Ойлгохгүй байгаа зүйлээ хичээлээр нь асуу, хүсвэл нэрээ нууцал.</li>
          <li><strong>Тусал.</strong> Мэддэг хичээлээ сонгоход тэр хичээлийн шинэ асуулт танд ирнэ.</li>
          <li><strong>Олоорой.</strong> Өмнө нь асуусан асуулт, “тусалсан” гэж тэмдэглэгдсэн хариултаас хай.</li>
        </ul>
        <p className="auth-foot">МУИС-ийн оюутнуудад зориулсан харилцан суралцах систем</p>
      </section>

      <div className="auth-card">
        <h2 className="auth-form-title">{mode === 'login' ? 'Нэвтрэх' : 'Бүртгэл үүсгэх'}</h2>
        <div className="segmented auth-tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => switchTo('login')}>Нэвтрэх</button>
          <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => switchTo('register')}>Бүртгүүлэх</button>
        </div>

        <form onSubmit={onSubmit} className="form">
          {mode === 'register' && (
            <label>Нэр
              <input value={form.name} onChange={set('name')} required minLength={2} maxLength={100} autoComplete="name" />
            </label>
          )}
          <label>Имэйл
            <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
          </label>
          <label>Нууц үг
            <input
              type="password" value={form.password} onChange={set('password')} required
              minLength={mode === 'register' ? 8 : undefined} maxLength={128}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
            {mode === 'register' && <small className="field-help">Хамгийн багадаа 8 тэмдэгт</small>}
          </label>

          {error && <p className="error" role="alert">{error}</p>}

          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Түр хүлээнэ үү…' : mode === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}
          </button>
        </form>
      </div>
    </div>
  );
}
