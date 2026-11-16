import { lazy, Suspense, useState } from 'react';
import { Check, Copy } from 'lucide-react';

const CodeHighlight = lazy(() => import('./CodeHighlight.jsx'));

// Асуулт, хариултын текст (FR-05, FR-09).
// Markdown-ийн цөөн хэсгийг дэмжинэ: ```код блок```, `inline код`, **тод**, http(s) холбоос.
// HTML-ийг хэзээ ч шууд оруулахгүй: бүх зүйл React-ийн элемент болж escape хийгдэнэ (NFR-04).

const FENCE_RE = /^(```|~~~)[ \t]*([\w+#.-]*)[ \t]*\n([\s\S]*?)\n?\1[ \t]*$/gm;
const INLINE_RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]])/g;

// Текстийг код блок ба энгийн хэсгүүдэд хуваана
export function splitBlocks(text) {
  const src = String(text ?? '').replace(/\r\n/g, '\n');
  const blocks = [];
  let last = 0;
  for (const m of src.matchAll(FENCE_RE)) {
    if (m.index > last) blocks.push({ type: 'text', value: src.slice(last, m.index) });
    blocks.push({ type: 'code', lang: m[2], value: m[3] });
    last = m.index + m[0].length;
  }
  if (last < src.length) blocks.push({ type: 'text', value: src.slice(last) });
  return blocks;
}

function Inline({ text }) {
  const out = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [tok] = m;
    if (m[1]) out.push(<code key={i++} className="inline-code">{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else out.push(<a key={i++} href={tok} target="_blank" rel="noopener noreferrer nofollow">{tok}</a>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* хуулах эрхгүй орчин */ }
  };
  return (
    <figure className="code-block">
      <figcaption className="code-head">
        <span>{lang || 'код'}</span>
        <button type="button" className="code-copy" onClick={copy} aria-label="Кодыг хуулах">
          {copied ? <><Check size={13} />Хуулсан</> : <><Copy size={13} />Хуулах</>}
        </button>
      </figcaption>
      {/* Өнгө ачаалагдах хүртэл энгийн кодыг харуулна */}
      <Suspense fallback={<pre className="code-pre"><code>{code.replace(/\n$/, '')}</code></pre>}>
        <CodeHighlight code={code} lang={lang} />
      </Suspense>
    </figure>
  );
}

export default function RichText({ text, className = '' }) {
  return (
    <div className={`body-text ${className}`}>
      {splitBlocks(text).filter((b) => b.type === 'code' || b.value.trim()).map((b, i) => (b.type === 'code'
        ? <CodeBlock key={i} code={b.value} lang={b.lang} />
        : <div key={i} className="text-run"><Inline text={b.value.replace(/^\n+|\n+$/g, '')} /></div>))}
    </div>
  );
}

// Жагсаалтын товч агуулгад тэмдэглэгээг арилгана
export const plainText = (text = '') => String(text)
  .replace(/```[\w+#.-]*\n?/g, ' ')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();
