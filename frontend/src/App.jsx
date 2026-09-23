import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import GameDetailPage from './pages/GameDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SettingsPage from './pages/SettingsPage';
import SearchPage from './pages/SearchPage';
import FriendsPage from './pages/FriendsPage';
import ProfilePage from './pages/ProfilePage';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';

function PrivateRoute({ children }) {
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace />;
  return children;
}

function AppShell() {
  const location = useLocation();
  const detalleBiblioteca = /^\/library\/[^/]+$/.test(location.pathname);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Navbar />
      <main className={detalleBiblioteca ? 'pb-8' : 'mx-auto max-w-7xl px-4 py-8'}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/library" element={<PrivateRoute><LibraryPage /></PrivateRoute>} />
            <Route path="/library/:id" element={<PrivateRoute><GameDetailPage /></PrivateRoute>} />
            <Route path="/buscar" element={<PrivateRoute><SearchPage /></PrivateRoute>} />
            <Route path="/amigos" element={<PrivateRoute><FriendsPage /></PrivateRoute>} />
            <Route path="/perfil/:username" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
            <Route path="/configuracion" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
