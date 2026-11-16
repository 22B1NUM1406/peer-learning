import { useRef, useState } from 'react';
import { Bold, Code, SquareCode } from 'lucide-react';
import RichText from './RichText.jsx';

// Асуулт, хариулт бичих талбар: код оруулах товчнууд ба "Урьдчилан харах" таб.
// Энгийн textarea хэвээр тул хуулж буулгах, гарын товчлол ердийнхөөрөө ажиллана.
export default function MarkdownEditor({ id, value, onChange, rows = 8, placeholder, required, minLength = 10, maxLength = 10000, autoFocus }) {
  const [tab, setTab] = useState('write');
  const ref = useRef(null);

  // Сонгосон текстийг тэмдэглэгээгээр хүрээлнэ; сонголтгүй бол жишээ текст оруулна
  const wrap = (before, after, sample) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || sample;
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };
  const codeBlock = () => {
    const el = ref.current;
    const atLineStart = !el || el.selectionStart === 0 || value[el.selectionStart - 1] === '\n';
    wrap(`${atLineStart ? '' : '\n'}\`\`\`java\n`, '\n```\n', 'код');
  };

  // Ctrl/Cmd+Enter-ээр маягт илгээнэ
  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') e.currentTarget.form?.requestSubmit();
  };

  return (
    <div className={`md-editor ${tab === 'preview' ? 'is-preview' : ''}`}>
      <div className="md-bar">
        <div className="md-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'active' : ''} onClick={() => setTab('write')}>Бичих</button>
          <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Урьдчилан харах</button>
        </div>
        {tab === 'write' && (
          <div className="md-tools">
            <button type="button" className="md-tool" onClick={() => wrap('**', '**', 'тод')} title="Тод (**текст**)" aria-label="Тод"><Bold size={15} /></button>
            <button type="button" className="md-tool" onClick={() => wrap('`', '`', 'код')} title="Мөр доторх код (`код`)" aria-label="Мөр доторх код"><Code size={15} /></button>
            <button type="button" className="md-tool" onClick={codeBlock} title="Код блок (```)" aria-label="Код блок"><SquareCode size={15} /><span>Код</span></button>
          </div>
        )}
      </div>
      {tab === 'write' ? (
        <textarea
          id={id} ref={ref} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
          rows={rows} placeholder={placeholder} required={required} minLength={minLength} maxLength={maxLength} autoFocus={autoFocus}
        />
      ) : (
        <div className="md-preview">
          {value.trim() ? <RichText text={value} /> : <p className="muted small">Урьдчилан харах зүйл алга.</p>}
          {/* Урьдчилан харах үед ч маягтын шалгалт ажиллахын тулд утгыг нуусан талбарт хадгална */}
          <textarea className="md-hidden" tabIndex={-1} aria-hidden="true" value={value} onChange={() => {}} required={required} minLength={minLength} onInvalid={() => setTab('write')} />
        </div>
      )}
      <div className="md-foot">
        <span>Код: <code>```</code> хооронд бичнэ (жишээ нь <code>```python</code>). <code>`мөр доторх`</code>, <code>**тод**</code></span>
        <span className="md-count">{value.length}/{maxLength}</span>
      </div>
    </div>
  );
}
