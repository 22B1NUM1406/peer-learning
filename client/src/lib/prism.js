// Кодын өнгөлгөө: prism-react-renderer нь JS, Python, C, C++, SQL зэргийг агуулдаг;
// МУИС-ийн хичээлд түгээмэл Java, C#-ийг prismjs-ээс нэмнэ.
import './prism-global.js';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';

export { Prism } from 'prism-react-renderer';

// Хэрэглэгчийн бичсэн хэлний нэрийг Prism-ийн нэр рүү хөрвүүлнэ
const ALIASES = { 'c++': 'cpp', 'c#': 'csharp', cs: 'csharp', js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash', html: 'markup', xml: 'markup' };
export const normalizeLang = (lang = '') => {
  const l = lang.trim().toLowerCase();
  return ALIASES[l] ?? l;
};
