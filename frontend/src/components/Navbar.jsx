import { Link } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10 shadow-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/library" className="flex items-center gap-2 text-indigo-400 font-bold text-xl hover:text-indigo-300 transition">
          <Gamepad2 className="w-8 h-8" />
          <span>GameTracker</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link to="/library" className="text-sm font-medium hover:text-indigo-400 transition">
            Mi Biblioteca
          </Link>
        </nav>
      </div>
    </header>
  );
}