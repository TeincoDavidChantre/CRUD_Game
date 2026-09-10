import { useState } from 'react';
import GameCard from '../components/GameCard';
import { PlusCircle, Gamepad2 } from 'lucide-react';

export default function LibraryPage() {
  // Datos MOCK iniciales para verificar renderizado
  const [games] = useState([
    { id: '1', title: 'The Witcher 3: Wild Hunt', genre: 'RPG', status: 'COMPLETADO', coverUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=600' },
    { id: '2', title: 'Elden Ring', genre: 'Action RPG', status: 'JUGANDO', coverUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600' },
    { id: '3', title: 'Hollow Knight', genre: 'Metroidvania', status: 'PENDIENTE', coverUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=600' },
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Mi Biblioteca</h1>
          <p className="text-slate-400 text-sm mt-1">Gestiona tu catálogo personal y seguimiento de progreso.</p>
        </div>

        <button className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition shadow-lg shadow-indigo-600/20">
          <PlusCircle className="w-5 h-5" />
          <span>Agregar Juego</span>
        </button>
      </div>

      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-800/40 rounded-2xl border border-dashed border-slate-700 text-center">
          <div className="p-4 bg-slate-800 rounded-full text-slate-400 mb-4">
            <Gamepad2 className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-bold text-slate-200">Tu biblioteca está vacía[cite: 2]</h3>
          <p className="text-slate-400 text-sm max-w-sm mt-1 mb-6">
            Aún no has añadido ningún videojuego. ¡Comienza a organizar tu colección personal![cite: 2]
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}