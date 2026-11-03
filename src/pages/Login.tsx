import clsx from 'clsx';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, FileText, ShieldCheck, TrendingUp } from 'lucide-react';
import { Logo } from '../components/Layout';
import { Button, Field } from '../components/ui';
import { useApp } from '../store/AppStore';

const benefits = [
  { icon: FileText, title: 'Grounded in your own documents', body: 'Every claim comes from your knowledge base.' },
  { icon: ShieldCheck, title: 'You approve before anything is published', body: 'Nothing goes out without your sign-off.' },
  { icon: TrendingUp, title: 'Judged by leads and sales, not likes', body: 'Dashboards lead with business outcomes.' },
];

export default function Login() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { signIn } = useApp();
  const navigate = useNavigate();

  const errors = {
    email: !email ? 'Enter your email address.' : !/^\S+@\S+\.\S+$/.test(email) ? 'That does not look like an email address.' : '',
    password: !password ? 'Enter your password.' : tab === 'signup' && password.length < 8 ? 'Use at least 8 characters.' : '',
    name: tab === 'signup' && !name ? 'Enter your business name.' : '',
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true, name: true });
    if (errors.email || errors.password || errors.name) return;
    signIn();
    navigate(tab === 'signup' ? '/business/new' : '/dashboard');
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 p-12 text-white lg:flex lg:flex-col">
        <div className="rounded-xl bg-white/95 px-3 py-2 shadow-sm self-start">
          <Logo />
        </div>
        <div className="mt-16 max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Turn a marketing goal
            <br />
            into a campaign that learns.
          </h1>
          <p className="mt-4 text-lg text-brand-100">
            Describe what you want for your business. We plan, draft and measure; you approve every post.
          </p>
          <ul className="mt-10 space-y-5">
            {benefits.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm text-brand-100">{body}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-auto flex items-end gap-4 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur">
          <div className="flex h-24 w-32 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 text-center text-xs text-slate-300">
            Class photo
          </div>
          <div className="text-sm">
            <BadgeCheck className="mb-1 h-5 w-5 text-emerald-300" />
            “We got 58 trial signups in September without writing a single post from scratch.”
            <div className="mt-1 text-brand-200">— Iron Peak Fitness, Champaign IL</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div role="tablist" className="mb-8 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setTouched({});
                }}
                className={clsx('rounded-md py-2 text-sm font-medium transition', tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
              >
                {t === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">{tab === 'login' ? 'Welcome back' : 'Create your workspace'}</h2>
          <p className="mt-1 text-sm text-slate-500">{tab === 'login' ? 'Log in to see how your goal is tracking.' : 'Free for your first campaign. No card needed.'}</p>

          <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
            {tab === 'signup' && (
              <Field label="Business name" error={touched.name ? errors.name : ''}>
                <input className="input" value={name} placeholder="Iron Peak Fitness" onChange={(e) => setName(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))} />
              </Field>
            )}
            <Field label="Email" error={touched.email ? errors.email : ''}>
              <input
                type="email"
                className="input"
                placeholder="you@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              />
            </Field>
            <Field label="Password" error={touched.password ? errors.password : ''}>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              />
            </Field>
            {tab === 'login' && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Keep me signed in
              </label>
            )}
            <Button variant="primary" size="lg" type="submit" className="w-full">
              {tab === 'login' ? 'Log in' : 'Create account'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button className="text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline">Forgot password?</button>
          </div>
          <p className="mt-10 text-center text-xs text-slate-400">
            By continuing you agree to the{' '}
            <a href="#" className="underline">Terms</a> and <a href="#" className="underline">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
