import { Highlight } from 'prism-react-renderer';
import { Prism, normalizeLang } from '../lib/prism.js';

// Кодын өнгөт тэмдэглэгээ. Prism том тул тусдаа хэсэг (chunk) болгон хэрэгтэй үед л ачаална.
export default function CodeHighlight({ code, lang }) {
  const language = normalizeLang(lang);
  const known = language && Prism.languages[language];
  return (
    <Highlight prism={Prism} code={code.replace(/\n$/, '')} language={known ? language : 'plain'} theme={THEME}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre className="code-pre"><code>
          {tokens.map((line, li) => (
            <span key={li} {...getLineProps({ line })}>
              {line.map((token, ti) => <span key={ti} {...getTokenProps({ token })} />)}
              {'\n'}
            </span>
          ))}
        </code></pre>
      )}
    </Highlight>
  );
}

// Системийн өнгөнд нийцүүлсэн цайвар загвар
const THEME = {
  plain: { color: '#1f2a37', backgroundColor: 'transparent' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#6b7685', fontStyle: 'italic' } },
    { types: ['keyword', 'builtin', 'important', 'atrule'], style: { color: '#7a3db8' } },
    { types: ['string', 'char', 'attr-value', 'regex', 'template-string'], style: { color: '#1e7a4c' } },
    { types: ['number', 'boolean', 'constant'], style: { color: '#b2510f' } },
    { types: ['function', 'class-name'], style: { color: '#2448a6' } },
    { types: ['operator', 'punctuation'], style: { color: '#4b5563' } },
    { types: ['tag', 'selector', 'property'], style: { color: '#a3305b' } },
    { types: ['variable', 'parameter'], style: { color: '#1f2a37' } },
  ],
};

