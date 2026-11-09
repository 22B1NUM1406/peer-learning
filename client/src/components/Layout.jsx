import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen, Flag, FolderOpen, GraduationCap, House, LogOut, MessageCircle, MessageSquareText, Plus, Settings, User,
} from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { connectSocket } from '../lib/socket.js';
import NotificationBell from './NotificationBell.jsx';
import { Avatar } from './ui.jsx';

// Нэвтэрсэн хуудсуудын нийтлэг хүрээ.
// Компьютерт дээд цэс, утсанд доод навигаци (NFR-06, 2.2-ын UI зарчим).
export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [newMessage, setNewMessage] = useState(false);

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

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAdmin = user.role === 'admin';
  // "Хариулах" нь нүүрний "Хариултгүй" таб; "Материал" нь хичээлийн жагсаалтыг материалын горимоор нээнэ
  const params = new URLSearchParams(location.search);
  const onHome = location.pathname === '/';
  const isUnanswered = onHome && params.get('sort') === 'unanswered';
  const onSubjects = location.pathname === '/subjects';
  const isResources = onSubjects && params.get('tab') === 'resources';
  const cls = (active) => (active ? 'active' : undefined);

  return (
    <>
      <header className="topbar">
        <Link to="/" title="Асуултууд" className="brand" aria-label="Нүүр хуудас">
          <span className="brand-mark"><GraduationCap size={20} /></span>
          <span className="brand-text">Харилцан суралцах<small>МУИС-ийн оюутнуудад</small></span>
        </Link>
        <nav className="topnav" aria-label="Үндсэн цэс">
          <Link to="/" className={cls(onHome && !isUnanswered)}><MessageSquareText size={17} /><span className="nav-label">Асуултууд</span></Link>
          <Link to="/?sort=unanswered" title="Хариулах" className={cls(isUnanswered)}><MessageCircle size={17} /><span className="nav-label">Хариулах</span></Link>
          <Link to="/subjects" title="Хичээлүүд" className={cls(onSubjects && !isResources)}><BookOpen size={17} /><span className="nav-label">Хичээлүүд</span></Link>
          <Link to="/subjects?tab=resources" title="Материал" className={cls(isResources)}><FolderOpen size={17} /><span className="nav-label">Материал</span></Link>
          <NavLink to="/messages" title="Мессеж">
            <MessageCircle size={17} /><span className="nav-label">Мессеж</span>{newMessage && <span className="dot" aria-label="шинэ" />}
          </NavLink>
          {isAdmin && <span className="nav-sep" aria-hidden="true" />}
          {isAdmin && <NavLink to="/admin/reports" title="Мэдээллүүд" aria-label="Мэдээллүүд"><Flag size={17} /><span className="nav-label-long">Мэдээллүүд</span></NavLink>}
          {isAdmin && <NavLink to="/admin/subjects" title="Хичээл удирдах" aria-label="Хичээл удирдах"><Settings size={17} /><span className="nav-label-long">Хичээл удирдах</span></NavLink>}
        </nav>
        <div className="topbar-right">
          <Link to="/questions/new" className="btn btn-primary btn-sm hide-mobile" aria-label="Асуулт асуух"><Plus size={17} /><span className="btn-label">Асуулт асуух</span></Link>
          <NotificationBell />
          <Link to={`/users/${user.id}`} className="me-link" title="Миний профайл">
            <Avatar name={user.name} size={30} />
            <span className="me-points hide-mobile"><strong>{user.name}</strong><span>{user.reputation} оноо</span></span>
          </Link>
          <button className="icon-btn" onClick={onLogout} aria-label="Гарах" title="Гарах"><LogOut size={19} /></button>
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>

      <nav className="bottomnav" aria-label="Утасны цэс">
        <NavLink to="/" end><House size={21} />Нүүр</NavLink>
        <NavLink to="/subjects"><BookOpen size={21} />Хичээл</NavLink>
        <NavLink to="/questions/new" className="ask"><span className="ask-ico"><Plus size={19} /></span>Асуух</NavLink>
        <NavLink to="/messages"><MessageCircle size={21} />Мессеж{newMessage && <span className="dot" />}</NavLink>
        {isAdmin
          ? <NavLink to="/admin/reports"><Flag size={21} />Админ</NavLink>
          : <NavLink to={`/users/${user.id}`}><User size={21} />Профайл</NavLink>}
      </nav>
    </>
  );
}
