import clsx from 'clsx';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Flag,
  LayoutDashboard,
  LogOut,
  Megaphone,
} from 'lucide-react';
import { useApp } from '../store/AppStore';

const nav = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, match: (p: string) => p.startsWith('/dashboard') },
  { label: 'Business Profile', to: '/business/new', icon: Building2, match: (p: string) => p.startsWith('/business') },
  { label: 'Knowledge Base', to: '/knowledge', icon: BookOpen, match: (p: string) => p.startsWith('/knowledge') },
  { label: 'Goals', to: '/goals/new', icon: Flag, match: (p: string) => p.startsWith('/goals') },
  {
    label: 'Campaigns',
    to: '/campaigns/7',
    icon: Megaphone,
    match: (p: string) => /^\/campaigns\/\d+(\/(results|recommendation))?$/.test(p),
  },
  { label: 'Content', to: '/campaigns/7/content', icon: CheckCircle2, match: (p: string) => p.endsWith('/content') },
  { label: 'Schedule', to: '/schedule', icon: CalendarClock, match: (p: string) => p.startsWith('/schedule') },
  { label: 'Analytics', to: '/campaigns/7/analytics', icon: BarChart3, match: (p: string) => p.endsWith('/analytics') },
];

export function Logo({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#4f46e5" />
        <path d="M8 22V10l8 7 8-7v12" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-slate-900">MarketMinds</div>
        <div className="text-[11px] font-medium text-slate-500">AI Marketing Manager</div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const { toasts, signOut, business, apiError } = useApp();
  const navigate = useNavigate();
  const initials = (business.name || 'MM')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      {apiError && (
        <div className="bg-rose-600 px-4 py-2 text-center text-sm text-white">
          {apiError}
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur">
        <Link to="/dashboard">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-[10px] font-bold text-white">{initials || 'MM'}</span>
            {business.name || 'Your business'}
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            <CircleHelp className="h-4 w-4" /> Help
          </button>
          <button
            title="Log out"
            onClick={() => {
              signOut();
              navigate('/login');
            }}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
          <div className="sticky top-16 px-3 py-5">
          <nav className="space-y-0.5">
            {nav.map(({ label, to, icon: Icon, match }) => {
              const active = match(pathname);
              return (
                <NavLink
                  key={label}
                  to={to}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <Icon className={clsx('h-4 w-4', active ? 'text-brand-600' : 'text-slate-400')} />
                  {label}
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
            <div className="mb-1 font-semibold text-slate-800">The loop</div>
            Goal → Strategy → Campaign → Content → Approval → Publish → Results → Learn → Next goal
          </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-7 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

const campaignTabs = [
  { label: 'Plan', to: '/campaigns/7' },
  { label: 'Content', to: '/campaigns/7/content' },
  { label: 'Results', to: '/campaigns/7/results' },
  { label: 'Analytics', to: '/campaigns/7/analytics' },
  { label: 'Recommendation', to: '/campaigns/7/recommendation' },
];

export function CampaignTabs() {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
      {campaignTabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            clsx(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
              isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800',
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
