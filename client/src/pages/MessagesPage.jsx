import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { connectSocket } from '../lib/socket.js';
import { timeAgo } from '../lib/format.js';
import ReportButton from '../components/ReportButton.jsx';
import { Avatar, Empty, ErrorText } from '../components/ui.jsx';

// P8: Мессеж — зүүн талд яриануудын жагсаалт, баруун талд сонгосон яриа (FR-22)
export default function MessagesPage() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);

  const loadConversations = () => api('/conversations').then((d) => setConversations(d.conversations)).catch(() => {});

  useEffect(() => { loadConversations(); }, []);

  // Шинэ мессеж ирэхэд жагсаалтыг шинэчилнэ
  useEffect(() => {
    const s = connectSocket();
    const onNew = () => loadConversations();
    s.on('message:new', onNew);
    return () => s.off('message:new', onNew);
  }, []);

  return (
    <div className={`messages ${userId ? 'has-thread' : ''}`}>
      <aside className="conv-list card">
        <h2 className="section-title no-top pad-x">Мессеж</h2>
        {conversations.length === 0 && <p className="muted small pad-x">Яриа алга. Туслагч оюутны профайлаас мессеж бичиж эхлээрэй.</p>}
        <ul>
          {conversations.map((c) => (
            <li key={c.userId}>
              <button className={`conv ${String(c.userId) === userId ? 'active' : ''}`} onClick={() => navigate(`/messages/${c.userId}`)}>
                <Avatar name={c.name} size={36} />
                <span className="conv-text">
                  <strong>{c.name}</strong>
                  <span className="muted small ellipsis">{c.lastFromMe ? 'Та: ' : ''}{c.lastBody}</span>
                </span>
                <span className="muted small">{timeAgo(c.lastAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="thread card">
        {userId && Number(userId) === user.id && <Empty>Өөртөө мессеж бичих боломжгүй</Empty>}
        {userId && Number(userId) !== user.id ? <Thread key={userId} otherId={Number(userId)} me={user} onSent={loadConversations} /> : !userId && <Empty>Яриа сонгоно уу</Empty>}
      </section>
    </div>
  );
}

function Thread({ otherId, me, onSent }) {
  const [other, setOther] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [hasOlder, setHasOlder] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    api(`/conversations/${otherId}/messages`)
      .then((d) => { setOther(d.user); setMessages(d.messages); setHasOlder(d.messages.length === 50); })
      .catch(setError);
  }, [otherId]);

  // Socket.IO: энэ ярианд хамаарах шинэ мессежийг шууд нэмнэ
  useEffect(() => {
    const s = connectSocket();
    const onNew = (m) => {
      const inThread = (m.senderId === otherId && m.receiverId === me.id) || (m.senderId === me.id && m.receiverId === otherId);
      if (inThread) setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
    };
    s.on('message:new', onNew);
    return () => s.off('message:new', onNew);
  }, [otherId, me.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const loadOlder = async () => {
    const d = await api(`/conversations/${otherId}/messages`, { params: { before: messages[0]?.id } });
    setMessages((list) => [...d.messages, ...list]);
    setHasOlder(d.messages.length === 50);
  };

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError(null);
    const s = connectSocket();
    // Socket холбогдсон бол түүгээр, эс бөгөөс REST-ээр илгээнэ
    try {
      if (s.connected) {
        const ack = await s.timeout(5000).emitWithAck('message:send', { to: otherId, body });
        if (!ack.ok) throw new Error(ack.error);
      } else {
        const d = await api(`/conversations/${otherId}/messages`, { method: 'POST', body: { body } });
        setMessages((list) => [...list, d.message]);
      }
      setText('');
      onSent();
    } catch (err) {
      setError(err);
    }
  };

  if (error && !other) return <ErrorText error={error} />;

  return (
    <>
      <header className="thread-head">
        <Link to="/messages" className="link-btn show-mobile">←</Link>
        {other && <Link to={`/users/${other.id}`} className="author-link"><Avatar name={other.name} size={32} /> <strong>{other.name}</strong></Link>}
      </header>
      <div className="thread-body">
        {hasOlder && <button className="link-btn small center-block" onClick={loadOlder}>Өмнөх мессежүүд</button>}
        {messages.length === 0 && <p className="muted center">Анхны мессежээ бичээрэй</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble-row ${m.senderId === me.id ? 'mine' : ''}`}>
            <div className="bubble">
              {m.body}
              <span className="bubble-meta">
                {timeAgo(m.createdAt)}
                {m.senderId !== me.id && <ReportButton targetType="message" targetId={m.id} label="мэдээлэх" />}
              </span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="thread-input" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Мессеж бичих…" aria-label="Мессеж" />
        <button className="btn btn-primary" disabled={!text.trim()}>Илгээх</button>
      </form>
      {error && <ErrorText error={error} />}
    </>
  );
}
