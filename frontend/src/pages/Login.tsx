/**
 * Login/PIN setup page for app protection.
 */

import { useState } from 'react';
import { Lock, Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const { needsSetup, login, setupPIN } = useAuth();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const success = await login(pin);
      if (!success) {
        setError('Falscher PIN');
        setPin('');
      }
    } catch (err) {
      setError('Fehler beim Anmelden');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.length < 4) {
      setError('PIN muss mindestens 4 Zeichen haben');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs stimmen nicht überein');
      return;
    }

    setIsSubmitting(true);
    try {
      await setupPIN(pin);
    } catch (err) {
      setError('Fehler beim Speichern des PINs');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sky-50 p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <Shield className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-primary-700">FLux</h1>
          <p className="text-gray-600 mt-2">
            {needsSetup
              ? 'Erstelle einen PIN zum Schutz deiner Daten'
              : 'Gib deinen PIN ein'}
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={needsSetup ? handleSetup : handleLogin}
          className="card"
        >
          <div className="space-y-4">
            {/* PIN Input */}
            <div>
              <label htmlFor="pin" className="label">
                {needsSetup ? 'Neuer PIN' : 'PIN'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="input pl-10 pr-10"
                  autoComplete="off"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPin ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm PIN (setup only) */}
            {needsSetup && (
              <div>
                <label htmlFor="confirmPin" className="label">
                  PIN bestätigen
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="confirmPin"
                    type={showPin ? 'text' : 'password'}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="••••"
                    className="input pl-10"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <p className="text-red-600 text-sm text-center">{error}</p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || !pin}
              className="w-full btn btn-primary disabled:opacity-50"
            >
              {isSubmitting
                ? 'Laden...'
                : needsSetup
                  ? 'PIN erstellen'
                  : 'Entsperren'}
            </button>
          </div>
        </form>

        {/* Info text */}
        <p className="text-center text-sm text-gray-500 mt-6">
          {needsSetup
            ? 'Der PIN schützt deine Gesundheitsdaten auf diesem Gerät.'
            : 'Deine Daten sind verschlüsselt und bleiben lokal.'}
        </p>
      </div>
    </div>
  );
}
