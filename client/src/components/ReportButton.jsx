import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { api } from '../lib/api.js';
import { Dialog, useFeedback } from '../lib/feedback.jsx';
import { ErrorText } from './ui.jsx';

// FR-15: контент мэдээлэх. Шалтгааныг серверийн жагсаалтаас сонгоно.
let reasonsCache = null;

export default function ReportButton({ targetType, targetId, label = 'Мэдээлэх' }) {
  const { toast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState(reasonsCache ?? []);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || reasonsCache) return;
    api('/reports/reasons').then((d) => { reasonsCache = d.reasons; setReasons(d.reasons); }).catch(setError);
  }, [open]);

  const close = () => { setOpen(false); setError(null); setReason(''); setDetails(''); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, reason, details: details || undefined } });
      close();
      toast('Мэдээлэл илгээгдлээ. Админ хянана.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="link-btn muted" onClick={() => setOpen(true)}>
        {label === 'Мэдээлэх' && <Flag size={13} />}{label}
      </button>
      {open && (
        <Dialog title="Яагаад мэдээлж байна вэ?" label="Мэдээлэх" onClose={close}>
          <form onSubmit={submit} className="form">
            <div className="radio-list" role="radiogroup" aria-label="Шалтгаан">
              {reasons.map((r) => (
                <label key={r} className={`radio ${reason === r ? 'on' : ''}`}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} required />
                  {r}
                </label>
              ))}
            </div>
            <label>Нэмэлт тайлбар <span className="optional">заавал биш</span>
              <input value={details} onChange={(e) => setDetails(e.target.value)} maxLength={200} />
            </label>
            <ErrorText error={error} />
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={close}>Болих</button>
              <button className="btn btn-primary" disabled={!reason || busy}>Илгээх</button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
