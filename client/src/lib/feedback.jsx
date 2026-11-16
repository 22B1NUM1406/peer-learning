import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

// Үйлдлийн хариу (toast) ба баталгаажуулах цонх (confirm).
// Хөтчийн confirm() нь загвар, хэлгүй, гар утсанд эвгүй тул өөрийн цонхоор солив.
const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);   // { title, body, confirmLabel, danger, resolve }
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback((message, { tone = 'ok' } = {}) => {
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3200);
  }, [dismiss]);

  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);

  const close = (value) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.tone === 'error' ? <CircleAlert size={17} /> : <CircleCheck size={17} />}
            <span>{t.message}</span>
            <button className="toast-x" onClick={() => dismiss(t.id)} aria-label="Хаах"><X size={15} /></button>
          </div>
        ))}
      </div>
      {dialog && (
        <Dialog title={dialog.title} onClose={() => close(false)}>
          {dialog.body && <p className="dialog-text">{dialog.body}</p>}
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => close(false)}>Болих</button>
            <button className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
              {dialog.confirmLabel ?? 'Тийм'}
            </button>
          </div>
        </Dialog>
      )}
    </FeedbackContext.Provider>
  );
}

export const useFeedback = () => useContext(FeedbackContext);

// Нийтлэг цонх: Esc болон гадна дарахад хаагдана, нээгдэхэд анхаарлыг цонх руу шилжүүлнэ
export function Dialog({ title, onClose, children, label }) {
  const ref = useRef(null);
  // onClose нь render бүрт шинэ функц байж болно: ref-ээр дамжуулж, эффектийг нэг л удаа ажиллуулна
  // (эс бөгөөс цонх доторх талбарт бичих бүрд анхаарал үсэрнэ)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current();
      // Tab-ийг цонх дотор эргүүлнэ: гарнаас ашиглахад анхаарал арын хуудас руу гарахгүй
      if (e.key === 'Tab' && ref.current) {
        const items = [...ref.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
          .filter((el) => !el.disabled && el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement;
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        className="dialog" role="dialog" aria-modal="true" aria-label={label ?? title} tabIndex={-1} ref={ref}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Хаах"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
