/**
 * Haupt-Layout mit unterer Navigation.
 */

import { NavLink, Outlet } from 'react-router-dom';
import { Home, PlusCircle, Upload, Settings } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Start' },
  { to: '/log', icon: PlusCircle, label: 'Eintrag' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/settings', icon: Settings, label: 'Einstellungen' },
];

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-sky-50">
      {/* Hauptinhalt */}
      <main className="flex-1 pb-20 overflow-auto">
        <Outlet />
      </main>

      {/* Untere Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-sky-200 safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-16 h-full transition-colors ${
                  isActive
                    ? 'text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`
              }
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-1">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
