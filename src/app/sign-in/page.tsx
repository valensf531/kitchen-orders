'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';
import { Eye, EyeOff, UtensilsCrossed, Loader2, CircleAlert, QrCode, ChefHat, Banknote, KeyRound } from 'lucide-react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn.email({ email, password, callbackURL: '/' });
      if (result.error) {
        setError(result.error.message || 'No pudimos iniciar sesión con esos datos');
        setIsLoading(false);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      window.location.href = '/';
    } catch {
      setError('No pudimos iniciar sesión. Revisá tu conexión e intentá de nuevo.');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(at 15% 0%, rgba(245,158,11,0.16) 0px, transparent 55%), radial-gradient(at 85% 10%, rgba(13,148,136,0.10) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(245,158,11,0.08) 0px, transparent 55%)',
        }}
      />

      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10 sm:px-6">
        <div className="mb-7 flex items-center gap-3">
          <span className="brand-mark">
            <UtensilsCrossed className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="brand-eyebrow">Gestión de pedidos</p>
            <h1 className="text-3xl font-black tracking-tight text-ink">Lumen</h1>
          </div>
        </div>

        <div className="surface p-6 shadow-lift sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-field bg-brand-soft text-brand-ink">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">Bienvenido</h2>
              <p className="text-sm text-ink-soft">Entrá con tu cuenta del restaurante.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="field-label">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                aria-invalid={Boolean(error)}
                className="field"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="field-label">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'signin-error' : undefined}
                  className="field pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-muted transition-colors hover:text-ink-soft focus-visible:ring-2 focus-visible:ring-brand-strong"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p id="signin-error" role="alert" className="notice notice-danger">
                <CircleAlert className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}

            <button type="submit" disabled={isLoading} className="btn btn-positive">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Iniciando sesión…
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-4 text-ink-muted">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <ChefHat className="h-3.5 w-3.5" aria-hidden="true" /> Cocina
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden="true" /> Salón
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <Banknote className="h-3.5 w-3.5" aria-hidden="true" /> Caja
            </span>
          </div>

          <p className="mt-5 text-center text-xs text-ink-muted">
            ¿Sin cuenta? Pedísela al administrador de tu restaurante.
          </p>
        </div>

        <Link
          href="/menu"
          className="mt-6 flex items-center justify-center gap-2 self-center rounded-field px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-brand-strong"
        >
          <QrCode className="h-4 w-4" aria-hidden="true" />
          Soy cliente · ver el menú
        </Link>
      </main>
    </div>
  );
}
