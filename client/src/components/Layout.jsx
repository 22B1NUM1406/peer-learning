import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen, CircleHelp, Flag, FolderOpen, GraduationCap, House, Library, LogOut, MessageCircle,
  MessagesSquare, Plus, Search, Settings, User, X,
} from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useDebounced } from '../lib/hooks.js';
import { connectSocket } from '../lib/socket.js';
import NotificationBell from './NotificationBell.jsx';
import { Avatar } from './ui.jsx';

// Профайл эсвэл туслах хичээл өөрчлөгдөхөд хажуугийн цэсийг шинэчлэх дохио
export const PROFILE_CHANGED = 'profile:changed';
export const notifyProfileChanged = () => window.dispatchEvent(new Event(PROFILE_CHANGED));

// Нэвтэрсэн хуудсуудын нийтлэг хүрээ (NFR-06).
// Компьютерт зүүн талын байнгын цэс, таблетад дүрс тэмдэгтэй нарийн цэс, утсанд дээд мөр ба доод навигаци.
export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [newMessage, setNewMessage] = useState(false);
  const me = useApi(`/users/${user.id}`);

  useEffect(() => {
    const onChange = () => me.reload();
    window.addEventListener(PROFILE_CHANGED, onChange);
    return () => window.removeEventListener(PROFILE_CHANGED, onChange);
  }, [me.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  // Мессежийн хуудсанд биш үед шинэ мессеж ирвэл цэг харуулна
  useEffect(() => {
    const s = connectSocket();
    const onNew = (m) => {
      if (m.senderId !== user.id && !location.pathname.startsWith('/messages')) setNewMessage(true);
    };
    s.on('message:new', onNew);
    return () => s.off('message:new', onNew);
  }, [user.id, location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith('/messages')) setNewMessage(false);
  }, [location.pathname]);

  // Хуудас солигдоход дээш гүйлгэнэ
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAdmin = user.role === 'admin';
  const params = new URLSearchParams(location.search);
  const onHome = location.pathname === '/';
  const isUnanswered = onHome && params.get('sort') === 'unanswered';
  const onSubjects = location.pathname === '/subjects';
  const isResources = onSubjects && params.get('tab') === 'resources';
  const cls = (active) => `nav-item${active ? ' active' : ''}`;
  const helpSubjects = me.data?.user.helpSubjects ?? [];
  const level = me.data?.user.level;

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Үндсэн цэс">
        <Link to="/" className="brand" aria-label="Нүүр хуудас">
          <span className="brand-mark"><GraduationCap size={18} /></span>
          <span className="brand-text">Харилцан суралцах<small>МУИС-ийн оюутнуудад</small></span>
        </Link>

        <Link to="/questions/new" className="btn btn-primary side-ask" aria-label="Асуулт асуух">
          <Plus size={17} /><span className="side-label">Асуулт асуух</span>
        </Link>

        <nav className="side-nav">
          <Link to="/" className={cls(onHome && !isUnanswered)} title="Асуултууд"><MessagesSquare size={18} /><span className="side-label">Асуултууд</span></Link>
          <Link to="/?sort=unanswered" className={cls(isUnanswered)} title="Хариулах"><CircleHelp size={18} /><span className="side-label">Хариулах</span></Link>
          <Link to="/subjects" className={cls(onSubjects && !isResources)} title="Хичээлүүд"><BookOpen size={18} /><span className="side-label">Хичээлүүд</span></Link>
          <Link to="/subjects?tab=resources" className={cls(isResources)} title="Материал"><FolderOpen size={18} /><span className="side-label">Материал</span></Link>
          <NavLink to="/messages" className={({ isActive }) => cls(isActive)} title="Мессеж">
            <MessageCircle size={18} /><span className="side-label">Мессеж</span>
            {newMessage && <span className="dot" aria-label="шинэ мессеж" />}
          </NavLink>
        </nav>

        {(!isAdmin || helpSubjects.length > 0) && (
        <div className="side-section">
          <div className="side-heading">Миний хичээлүүд</div>
          {helpSubjects.length > 0 ? (
            <ul className="side-subjects">
              {helpSubjects.map((s) => (
                <li key={s.id}>
                  <NavLink to={`/subjects/${s.id}`} className={({ isActive }) => cls(isActive)} title={s.name}>
                    <span className="subj-dot" aria-hidden="true" /><span className="side-label">{s.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          ) : me.data && (
            <Link to={`/users/${user.id}?edit=1`} className="side-hint">
              <Library size={16} /><span className="side-label">Туслах хичээлээ сонгоорой. Тэр хичээлийн шинэ асуулт танд ирнэ.</span>
            </Link>
          )}
        </div>
        )}

        {isAdmin && (
          <div className="side-section">
            <div className="side-heading">Админ</div>
            <NavLink to="/admin/reports" className={({ isActive }) => cls(isActive)} title="Мэдээллүүд"><Flag size={18} /><span className="side-label">Мэдээллүүд</span></NavLink>
            <NavLink to="/admin/subjects" className={({ isActive }) => cls(isActive)} title="Хичээл удирдах"><Settings size={18} /><span className="side-label">Хичээл удирдах</span></NavLink>
          </div>
        )}

        <div className="side-me">
          <div className="side-me-row">
            <Link to={`/users/${user.id}`} className="me-link" title="Миний профайл">
              <Avatar name={user.name} size={32} />
              <span className="me-text side-label">
                <strong>{user.name}</strong>
                <span>{level ? level.name : user.role === 'admin' ? 'Админ' : 'Оюутан'}</span>
              </span>
            </Link>
            <button className="icon-btn side-logout" onClick={onLogout} aria-label="Гарах" title="Гарах"><LogOut size={17} /></button>
          </div>
          {level && user.role !== 'admin' && <LevelMeter level={level} reputation={user.reputation} />}
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <Link to="/" className="brand brand-mobile" aria-label="Нүүр хуудас">
            <span className="brand-mark"><GraduationCap size={18} /></span>
          </Link>
          <GlobalSearch />
          <div className="topbar-right">
            <NotificationBell />
            <Link to={`/users/${user.id}`} className="top-me" aria-label="Миний профайл"><Avatar name={user.name} size={30} /></Link>
          </div>
        </header>

        <main className="content" id="main">
          <Outlet />
        </main>
      </div>

      <nav className="bottomnav" aria-label="Утасны цэс">
        <NavLink to="/" end><House size={21} />Нүүр</NavLink>
        <NavLink to="/subjects"><BookOpen size={21} />Хичээл</NavLink>
        <NavLink to="/questions/new" className="ask"><span className="ask-ico"><Plus size={19} /></span>Асуух</NavLink>
        <NavLink to="/messages"><MessageCircle size={21} />Мессеж{newMessage && <span className="dot" />}</NavLink>
        {isAdmin
          ? <NavLink to="/admin/reports"><Flag size={21} />Админ</NavLink>
          : <NavLink to={`/users/${user.id}`}><User size={21} />Профайл</NavLink>}
      </nav>
    </div>
  );
}

// Хажуугийн цэсний доод хэсэг: дараагийн түвшин хүртэлх явц (FR-30)
const LEVEL_FROM = { newcomer: 0, helper: 10, active: 50, expert: 200 };
function LevelMeter({ level, reputation }) {
  const from = LEVEL_FROM[level.key] ?? 0;
  const pct = level.nextAt ? Math.min(100, Math.round(((reputation - from) / (level.nextAt - from)) * 100)) : 100;
  return (
    <div className="me-level side-label" title={level.nextAt ? `“${level.nextName}” хүртэл ${level.nextAt - reputation} оноо` : 'Хамгийн дээд түвшин'}>
      <div className="me-level-row"><span>{reputation} оноо</span><span>{level.nextAt ? `${level.nextName}: ${level.nextAt}` : 'Дээд түвшин'}</span></div>
      <div className="meter gold"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

// Дээд мөрийн хайлт (FR-13). Бичих үед нүүр хуудасны жагсаалтыг шүүнэ;
// бусад хуудаснаас хайвал нүүр хуудас руу шилжинэ. Утсанд дүрс дарахад нээгдэнэ.
function GlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const onHome = location.pathname === '/';
  const urlQ = onHome ? params.get('q') ?? '' : '';
  const [text, setText] = useState(urlQ);
  const [open, setOpen] = useState(false);
  const q = useDebounced(text.trim(), 350);
  const typed = useRef(false);
  const inputRef = useRef(null);

  // Хаягийн мөрөөс (жишээ нь хайлтыг цэвэрлэх) өөрчлөгдвөл талбарыг тааруулна
  useEffect(() => { if (!typed.current) setText((t) => (t.trim() === urlQ ? t : urlQ)); }, [urlQ]);

  useEffect(() => {
    if (!typed.current) return;
    typed.current = false;
    if (!onHome && !q) return;
    const next = new URLSearchParams(onHome ? location.search : '');
    if (q) next.set('q', q); else next.delete('q');
    const s = next.toString();
    navigate(s ? `/?${s}` : '/', { replace: onHome });
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  return (
    <div className={`global-search ${open ? 'open' : ''}`}>
      <button className="icon-btn search-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Хайлт хаах' : 'Хайлт нээх'}>
        {open ? <X size={19} /> : <Search size={19} />}
      </button>
      <label className="search-box">
        <Search size={16} />
        <input
          ref={inputRef} type="search" placeholder="Асуулт хайх" aria-label="Хайх"
          value={text}
          onChange={(e) => { typed.current = true; setText(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setText(''); typed.current = true; } }}
        />
      </label>
    </div>
  );
}
