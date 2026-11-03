import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Facebook, Instagram, Linkedin, Layers } from 'lucide-react';
import type { Platform } from '../data/mock';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  icon,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'px-2.5 py-1.5 text-xs',
        size === 'md' && 'px-3.5 py-2 text-sm',
        size === 'lg' && 'px-5 py-2.5 text-sm',
        variant === 'primary' && 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
        variant === 'secondary' && 'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
        variant === 'danger' && 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function Card({ className, children, title, action, subtitle }: { className?: string; children: ReactNode; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <section className={clsx('rounded-xl border border-slate-200 bg-white shadow-card', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, right, eyebrow }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  Indexed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Processing: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  Failed: 'bg-rose-50 text-rose-700 ring-rose-600/30 ring-dashed',
  Draft: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  Awaiting: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  'Awaiting approval': 'bg-amber-50 text-amber-800 ring-amber-600/20',
  Edited: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Rejected: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  Scheduled: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  Published: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Missed: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  Live: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'Plan ready': 'bg-brand-50 text-brand-700 ring-brand-600/20',
  Connected: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Imported: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  Typed: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  Sample: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  Observed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Attributed: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  'AI-inferred': 'bg-violet-50 text-violet-700 ring-violet-600/20',
  Accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Dismissed: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

/** Status is always shown as a word; failures also get a dashed outline so color is never the only signal. */
export function StatusChip({ status, className }: { status: string; className?: string }) {
  const failed = status === 'Failed';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        statusStyles[status] ?? 'bg-slate-100 text-slate-700 ring-slate-500/20',
        failed && 'border border-dashed border-rose-400 ring-0',
        className,
      )}
    >
      {status}
    </span>
  );
}

const platformMeta: Record<Platform | 'All', { short: string; icon: ReactNode; cls: string }> = {
  Instagram: { short: 'IG', icon: <Instagram className="h-3 w-3" />, cls: 'bg-pink-50 text-pink-700 ring-pink-600/20' },
  Facebook: { short: 'FB', icon: <Facebook className="h-3 w-3" />, cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  LinkedIn: { short: 'LI', icon: <Linkedin className="h-3 w-3" />, cls: 'bg-sky-50 text-sky-800 ring-sky-700/20' },
  All: { short: 'All', icon: <Layers className="h-3 w-3" />, cls: 'bg-slate-100 text-slate-700 ring-slate-500/20' },
};

export function PlatformTag({ platform, full }: { platform: Platform | 'All'; full?: boolean }) {
  const m = platformMeta[platform];
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', m.cls)}>
      {m.icon}
      {full ? platform : m.short}
    </span>
  );
}

export function SourceTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
      <span aria-hidden>↳</span> {children}
    </span>
  );
}

export function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Chip({ selected, onClick, children }: { selected?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition',
        selected ? 'border-brand-600 bg-brand-50 font-semibold text-brand-800' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400',
      )}
    >
      {selected && <span aria-hidden>✓</span>}
      {children}
    </button>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function Select({ value, onChange, options, className }: { value: string; onChange: (v: string) => void; options: string[]; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={clsx('input w-auto pr-8', className)}>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

export const fmt = (n: number) => n.toLocaleString('en-US');
