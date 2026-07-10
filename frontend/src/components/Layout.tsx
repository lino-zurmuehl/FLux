/**
 * Haupt-Layout mit unterer Navigation im Flo-Stil
 * (erhöhter Plus-Button in der Mitte für den Tageseintrag).
 */

import { NavLink, Outlet } from 'react-router-dom';
import { Home, Plus, CalendarDays, BarChart3, Settings } from 'lucide-react';

const leftItems = [
  { to: '/', icon: Home, label: 'Heute' },
  { to: '/calendar', icon: CalendarDays, label: 'Kalender' },
];
const rightItems = [
  { to: '/history', icon: BarChart3, label: 'Verlauf' },
  { to: '/settings', icon: Settings, label: 'Mehr' },
];

function NavItem({ to, icon: Icon, label }: { to: string; icon: typeof Home; label: string }) {
  return (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center w-16 h-full transition-colors ${
          isActive ? 'text-primary-700' : 'text-gray-400 hover:text-gray-600'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex items-center justify-center rounded-full px-4 py-1 transition-colors ${
              isActive ? 'bg-primary-100' : ''
            }`}
          >
            <Icon className="w-5 h-5" />
          </span>
          <span className={`text-[11px] mt-0.5 ${isActive ? 'font-semibold' : ''}`}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-sky-50">
      {/* Hauptinhalt */}
      <main className="flex-1 pb-24 overflow-auto">
        <Outlet />
      </main>

      {/* Untere Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-sky-100 rounded-t-3xl shadow-[0_-4px_16px_rgba(0,0,0,0.06)] safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {leftItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}

          {/* Erhöhter Eintrag-Button */}
          <NavLink
            to="/log"
            className="flex flex-col items-center justify-center w-16 -mt-7"
            aria-label="Eintrag"
          >
            {({ isActive }) => (
              <>
                <span
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${
                    isActive
                      ? 'bg-gradient-to-b from-primary-600 to-primary-800'
                      : 'bg-gradient-to-b from-primary-400 to-primary-600'
                  }`}
                >
                  <Plus className="w-7 h-7 text-white" />
                </span>
                <span
                  className={`text-[11px] mt-0.5 ${
                    isActive ? 'text-primary-700 font-semibold' : 'text-gray-400'
                  }`}
                >
                  Eintrag
                </span>
              </>
            )}
          </NavLink>

          {rightItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>
      </nav>
    </div>
  );
}
