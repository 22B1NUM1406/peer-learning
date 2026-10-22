import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="container center">
      <h1>Хуудас олдсонгүй</h1>
      <Link to="/">Нүүр хуудас руу буцах</Link>
    </div>
  );
}
