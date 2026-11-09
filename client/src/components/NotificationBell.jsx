import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';

// P9: толгой хэсгийн хонх + унжих жагсаалт (FR-19).
// Мэдэгдлийг 30 секунд тутам шалгана (polling); тусдаа сервис, WebSocket шаардахгүй.
const POLL_MS = 30000;
const TEXT = {
  new_answer: 'Таны асуултад шинэ хариулт ирлээ',
  accepted: 'Таны хариултыг “тусалсан” гэж тэмдэглэлээ',
};

export default function NotificationBell() {
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(() => api('/notifications').then(setData).catch(() => {}), []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Гадна дарвал хаана
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.isRead) await api(`/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {});
    load();
    navigate(`/questions/${n.questionId}`);
  };

  const readAll = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    load();
  };

  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn" aria-label={`Мэдэгдэл, уншаагүй ${data.unread}`} onClick={() => setOpen(!open)}>
        <Bell size={20} />
        {data.unread > 0 && <span className="badge">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="dropdown card">
          <div className="dropdown-head">
            <strong>Мэдэгдэл</strong>
            {data.unread > 0 && <button className="link-btn small" onClick={readAll}><CheckCheck size={15} />Бүгдийг уншсан</button>}
          </div>
          {data.notifications.length === 0 && <p className="muted pad">Мэдэгдэл алга</p>}
          <ul>
            {data.notifications.map((n) => (
              <li key={n.id}>
                <button className={n.isRead ? 'notif' : 'notif unread'} onClick={() => openItem(n)}>
                  <span>{TEXT[n.type]}</span>
                  <span className="notif-q">{n.questionTitle}</span>
                  <span className="muted small">{timeAgo(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
