import { Link } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="notfound">
      <span className="empty-icon"><MapPinOff size={22} /></span>
      <h1>Хуудас олдсонгүй</h1>
      <p>Холбоос буруу эсвэл хуудас устгагдсан байж магадгүй.</p>
      <Link to="/" className="btn btn-primary">Нүүр хуудас руу буцах</Link>
    </div>
  );
}
