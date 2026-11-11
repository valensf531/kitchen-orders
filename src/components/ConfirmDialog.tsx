'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputRequired?: boolean;
  multiline?: boolean;
  hideCancel?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/* Modal único para confirmaciones y motivos (reemplaza confirm/prompt/alert
   nativos, que en móvil son feos y bloquean la interfaz). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  inputLabel,
  inputPlaceholder,
  inputRequired = false,
  multiline = false,
  hideCancel = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [value, setValue] = useState('');
  const titleId = useId();
  const messageId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (inputLabel) inputRef.current?.focus();
      else if (danger) cancelRef.current?.focus();
      else confirmRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [open, inputLabel, danger]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const disabled = busy || (inputRequired && !value.trim());

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                danger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-bold text-slate-800">
                {title}
              </h2>
              {message && (
                <p id={messageId} className="mt-1 text-sm leading-relaxed text-slate-500">
                  {message}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {inputLabel && (
          <div className="px-5 pt-4">
            <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-slate-600">
              {inputLabel}
              {!inputRequired && (
                <span className="font-normal text-slate-400"> (opcional)</span>
              )}
            </label>
            {multiline ? (
              <textarea
                id={inputId}
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={inputPlaceholder}
                rows={3}
                disabled={busy}
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              />
            ) : (
              <input
                id={inputId}
                ref={inputRef as React.RefObject<HTMLInputElement>}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !disabled) {
                    event.preventDefault();
                    onConfirm(value);
                  }
                }}
                placeholder={inputPlaceholder}
                disabled={busy}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              />
            )}
          </div>
        )}

        <div className="flex gap-2 p-5">
          {!hideCancel && (
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onConfirm(value)}
            disabled={disabled}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
