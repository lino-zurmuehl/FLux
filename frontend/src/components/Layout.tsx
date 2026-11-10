/** Haupt-Layout mit ruhiger Navigation und Fokus auf Heute und Kalender. */

import { NavLink, Outlet } from 'react-router-dom';
import { Home, CalendarDays, BarChart3, Settings } from 'lucide-react';

const items = [
  { to: '/', icon: Home, label: 'Heute' },
  { to: '/calendar', icon: CalendarDays, label: 'Kalender' },
  { to: '/history', icon: BarChart3, label: 'Verlauf' },
  { to: '/settings', icon: Settings, label: 'Mehr' },
];

function NavItem({ to, icon: Icon, label }: { to: string; icon: typeof Home; label: string }) {
  return (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
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
      <nav aria-label="Hauptnavigation" className="fixed bottom-0 left-0 right-0 bg-white border-t border-sky-100 rounded-t-3xl shadow-[0_-4px_16px_rgba(0,0,0,0.06)] safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {items.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>
      </nav>
    </div>
  );
}
