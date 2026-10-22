import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {data.unread > 0 && <span className="badge">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="dropdown card">
          <div className="dropdown-head">
            <strong>Мэдэгдэл</strong>
            {data.unread > 0 && <button className="link-btn" onClick={readAll}>Бүгдийг уншсан</button>}
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
