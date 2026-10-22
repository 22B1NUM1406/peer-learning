import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">Харилцан суралцах</Link>
        <nav className="topnav" aria-label="Үндсэн цэс">
          <NavLink to="/" end>Асуултууд</NavLink>
          <NavLink to="/messages">Мессеж{newMessage && <span className="dot" aria-label="шинэ" />}</NavLink>
          {isAdmin && <NavLink to="/admin/reports">Мэдээллүүд</NavLink>}
          {isAdmin && <NavLink to="/admin/subjects">Хичээлүүд</NavLink>}
        </nav>
        <div className="topbar-right">
          <Link to="/questions/new" className="btn btn-primary btn-sm hide-mobile">Асуулт асуух</Link>
          <NotificationBell />
          <Link to={`/users/${user.id}`} className="me-link" title="Миний профайл">
            <Avatar name={user.name} size={30} />
            <span className="hide-mobile">{user.reputation} оноо</span>
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Гарах</button>
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>

      <nav className="bottomnav" aria-label="Утасны цэс">
        <NavLink to="/" end>Нүүр</NavLink>
        <NavLink to="/questions/new">Асуух</NavLink>
        <NavLink to="/messages">Мессеж{newMessage && <span className="dot" />}</NavLink>
        {isAdmin
          ? <NavLink to="/admin/reports">Админ</NavLink>
          : <NavLink to={`/users/${user.id}`}>Профайл</NavLink>}
      </nav>
    </>
  );
}
