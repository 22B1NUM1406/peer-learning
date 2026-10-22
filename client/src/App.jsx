import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import HomePage from './pages/HomePage.jsx';
import AskPage from './pages/AskPage.jsx';
import QuestionPage from './pages/QuestionPage.jsx';
import SubjectPage from './pages/SubjectPage.jsx';
import ResourceNewPage from './pages/ResourceNewPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import MessagesPage from './pages/MessagesPage.jsx';
import AdminReportsPage from './pages/AdminReportsPage.jsx';
import AdminSubjectsPage from './pages/AdminSubjectsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

// Нэвтрээгүй хэрэглэгчийг /login руу шилжүүлнэ.
// Энэ нь зөвхөн тав тухтай байдлын төлөө: жинхэнэ хамгаалалт серверийн requireAuth-д.
function Protected({ children, admin = false }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted center pad">Ачаалж байна…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

// Хуудаснуудын дугаар нь тайлангийн 2.2-ын UI хүснэгттэй (P1–P11) таарна
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />                                    {/* P1 */}
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<HomePage />} />                                       {/* P2 */}
        <Route path="/questions/new" element={<AskPage />} />                           {/* P3 */}
        <Route path="/questions/:id/edit" element={<AskPage />} />                      {/* P3 засах */}
        <Route path="/questions/:id" element={<QuestionPage />} />                      {/* P4 */}
        <Route path="/subjects/:id" element={<SubjectPage />} />                        {/* P5 */}
        <Route path="/resources/new" element={<ResourceNewPage />} />                   {/* P6 */}
        <Route path="/users/:id" element={<ProfilePage />} />                           {/* P7 */}
        <Route path="/messages" element={<MessagesPage />} />                           {/* P8 */}
        <Route path="/messages/:userId" element={<MessagesPage />} />
        <Route path="/admin/reports" element={<Protected admin><AdminReportsPage /></Protected>} />   {/* P10 */}
        <Route path="/admin/subjects" element={<Protected admin><AdminSubjectsPage /></Protected>} /> {/* P11 */}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
