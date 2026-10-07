'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { signUp } from '@/lib/auth-client';
import { Eye, EyeOff, UtensilsCrossed, Loader2, CircleAlert, QrCode } from 'lucide-react';

const STRENGTH = [
  { label: 'Muy débil', bar: 'w-1/4', color: 'bg-danger' },
  { label: 'Débil', bar: 'w-2/4', color: 'bg-brand' },
  { label: 'Buena', bar: 'w-3/4', color: 'bg-brand-strong' },
  { label: 'Segura', bar: 'w-full', color: 'bg-positive' },
];

function scorePassword(password: string) {
  if (!password) return -1;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-ZÁÉÍÓÚÑ]/.test(password) && /[a-záéíóúñ]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-zÁÉÍÓÚÑáéíóúñ\d]/.test(password)) score += 1;
  return Math.min(score, 3);
}

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signUp.email({ email, password, name });
      if (result.error) {
        setError(result.error.message || 'No pudimos crear la cuenta');
        setIsLoading(false);
        return;
      }
      window.location.href = '/';
    } catch {
      setError('No pudimos crear la cuenta. Revisá tu conexión e intentá de nuevo.');
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
          <h2 className="text-2xl font-bold tracking-tight text-ink">Creá tu cuenta</h2>
          <p className="mt-1.5 text-sm text-ink-soft">Empezá a gestionar los pedidos de tu restaurante.</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
            <div>
              <label htmlFor="name" className="field-label">
                Nombre
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                autoFocus
                className="field"
                placeholder="Tu nombre"
              />
            </div>

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
                  minLength={8}
                  autoComplete="new-password"
                  aria-describedby="password-hint"
                  className="field pr-12"
                  placeholder="Mínimo 8 caracteres"
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

              <div id="password-hint" className="mt-2.5">
                <div className="flex gap-1.5" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i <= strength ? (STRENGTH[strength]?.color ?? 'bg-line') : 'bg-line'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">
                  {strength >= 0 ? `Contraseña ${STRENGTH[strength].label.toLowerCase()}` : 'Mínimo 8 caracteres'}
                </p>
              </div>
            </div>

            {error && (
              <p role="alert" className="notice notice-danger">
                <CircleAlert className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}

            <button type="submit" disabled={isLoading} className="btn btn-positive">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creando cuenta…
                </>
              ) : (
                'Crear cuenta'
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest text-ink-muted">o</span>
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
          </div>

          <Link
            href="/sign-in"
            className="mt-5 flex w-full items-center justify-center rounded-field bg-brand-soft px-5 py-3 text-sm font-bold text-brand-ink transition-colors hover:bg-brand hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2"
          >
            Ya tengo cuenta
          </Link>
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
