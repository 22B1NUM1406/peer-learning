import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// FR-15: контент мэдээлэх. Шалтгааныг серверийн жагсаалтаас сонгоно.
let reasonsCache = null;

export default function ReportButton({ targetType, targetId, label = 'Мэдээлэх' }) {
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState(reasonsCache ?? []);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState(null); // null | 'sent' | Error

  useEffect(() => {
    if (!open || reasonsCache) return;
    api('/reports/reasons').then((d) => { reasonsCache = d.reasons; setReasons(d.reasons); });
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, reason, details: details || undefined } });
      setStatus('sent');
    } catch (err) {
      setStatus(err);
    }
  };

  const close = () => { setOpen(false); setStatus(null); setReason(''); setDetails(''); };

  return (
    <>
      <button type="button" className="link-btn muted" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal card" role="dialog" aria-modal="true" aria-label="Мэдээлэх" onClick={(e) => e.stopPropagation()}>
            {status === 'sent' ? (
              <>
                <h3>Баярлалаа</h3>
                <p>Таны мэдээллийг админ хянана.</p>
                <button className="btn btn-primary" onClick={close}>Хаах</button>
              </>
            ) : (
              <form onSubmit={submit} className="form">
                <h3>Яагаад мэдээлж байна вэ?</h3>
                <div className="radio-list">
                  {reasons.map((r) => (
                    <label key={r} className="radio">
                      <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} required />
                      {r}
                    </label>
                  ))}
                </div>
                <label>Нэмэлт тайлбар (заавал биш)
                  <input value={details} onChange={(e) => setDetails(e.target.value)} maxLength={200} />
                </label>
                {status instanceof Error && <p className="error">{status.message}</p>}
                <div className="row-end">
                  <button type="button" className="btn btn-ghost" onClick={close}>Болих</button>
                  <button className="btn btn-primary" disabled={!reason}>Илгээх</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
