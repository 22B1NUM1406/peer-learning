import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, BookOpen, Bookmark, CheckCheck, CircleCheck, MessageSquareText, ThumbsUp } from 'lucide-react';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';

// P9: толгой хэсгийн хонх + унжих жагсаалт (FR-19).
// Мэдэгдлийг 30 секунд тутам шалгана (polling); тусдаа сервис, WebSocket шаардахгүй.
const POLL_MS = 30000;
const TEXT = {
  new_answer: 'Таны асуултад шинэ хариулт ирлээ',
  accepted: 'Таны хариултыг “тусалсан” гэж тэмдэглэлээ',
  new_question: 'Таны туслах хичээлд шинэ асуулт ирлээ',
  vote: 'Таны хариултыг “тустай” гэж үнэллээ',
  followed_answer: 'Таны хадгалсан асуултад шинэ хариулт ирлээ',
};

const ICON = { new_answer: MessageSquareText, accepted: CircleCheck, new_question: BookOpen, vote: ThumbsUp, followed_answer: Bookmark };

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

  // Гадна дарах эсвэл Esc дарахад хаана
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
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
      <button className="icon-btn" aria-label={`Мэдэгдэл, уншаагүй ${data.unread}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={19} />
        {data.unread > 0 && <span className="badge">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="dropdown">
          <div className="dropdown-head">
            <strong>Мэдэгдэл</strong>
            {data.unread > 0 && <button className="link-btn small" onClick={readAll}><CheckCheck size={15} />Бүгдийг уншсан</button>}
          </div>
          {data.notifications.length === 0 && (
            <div className="dropdown-empty"><BellOff size={18} /><span>Мэдэгдэл алга. Таны асуултад хариулт ирэх, хариултыг тань үнэлэхэд энд харагдана.</span></div>
          )}
          <ul>
            {data.notifications.map((n) => {
              const Icon = ICON[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button className={n.isRead ? 'notif' : 'notif unread'} onClick={() => openItem(n)}>
                    <span className={`notif-icon t-${n.type}`}><Icon size={14} /></span>
                    <span className="notif-text">
                      <span>{TEXT[n.type]}</span>
                      <span className="notif-q">{n.questionTitle}</span>
                      <span className="muted small">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
