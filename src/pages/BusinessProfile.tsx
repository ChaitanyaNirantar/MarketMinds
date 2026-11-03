import clsx from 'clsx';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Chip, Field, PageHeader } from '../components/ui';
import { brandVoices, industries, type Product } from '../data/mock';
import { useApp } from '../store/AppStore';

const steps = ['Business', 'Products', 'Audience', 'Brand voice'];

export default function BusinessProfile() {
  const { notify, business, products, saveBusiness } = useApp();
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [form, setForm] = useState({ name: business.name, website: business.website, industry: business.industry, location: business.location, description: business.description });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<Product[]>(products);
  const [voices, setVoices] = useState<string[]>(business.brandVoices.length ? business.brandVoices : ['Friendly', 'Inspirational']);
  const [audience, setAudience] = useState(business.audience);
  const navigate = useNavigate();

  const errors: Record<string, string> = {
    name: form.name.trim() ? '' : 'Business name is required.',
    industry: form.industry ? '' : 'Pick an industry.',
    description: form.description.trim().length >= 20 ? '' : 'Write at least a sentence (20+ characters).',
  };
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  const next = () => {
    if (step === 0) {
      setTouched({ name: true, industry: true, description: true });
      if (Object.values(errors).some(Boolean)) return;
    }
    if (step === steps.length - 1) {
      void saveBusiness({
        business: { ...business, ...form, audience, brandVoices: voices },
        products: items,
      }).then(() => {
        notify('Business profile saved');
        navigate('/knowledge');
      });
      return;
    }
    setStep(step + 1);
    setMaxStep(Math.max(maxStep, step + 1));
  };

  const toggleVoice = (v: string) =>
    setVoices((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : cur.length >= 3 ? cur : [...cur, v]));

  return (
    <>
      <PageHeader title="Tell us about your business" subtitle={`The AI will use this to write marketing that sounds like you. Step ${step + 1} of 4.`} />

      <ol className="mb-6 grid grid-cols-4 gap-2">
        {steps.map((s, i) => {
          const done = i < step || (i <= maxStep && i !== step);
          const current = i === step;
          const clickable = i <= maxStep;
          return (
            <li key={s}>
              <button
                disabled={!clickable}
                onClick={() => clickable && setStep(i)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                  current ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white',
                  clickable && !current && 'hover:border-slate-300',
                  !clickable && 'cursor-default',
                )}
              >
                <span
                  className={clsx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    current ? 'bg-brand-600 text-white' : done ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {done && !current ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={clsx('text-sm', current ? 'font-semibold text-brand-800' : 'font-medium text-slate-600')}>{s}</span>
              </button>
              <div className={clsx('mt-2 h-1 rounded-full', i <= step ? 'bg-brand-600' : 'bg-slate-200')} />
            </li>
          );
        })}
      </ol>

      <Card className="p-6">
        {step === 0 && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Business name" required error={touched.name ? errors.name : ''}>
              <input className="input" value={form.name} onBlur={blur('name')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Website">
              <input className="input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </Field>
            <Field label="Industry" required error={touched.industry ? errors.industry : ''}>
              <select className="input" value={form.industry} onBlur={blur('industry')} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                <option value="">Select…</option>
                {industries.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <div className="md:col-span-2">
              <Field label="What does your business do?" required error={touched.description ? errors.description : ''} hint="In your own words. The AI uses this as context for every post.">
                <textarea rows={3} className="input" value={form.description} onBlur={blur('description')} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
          </div>
        )}

        {(step === 0 || step === 1) && (
          <div className={clsx(step === 0 && 'mt-6 border-t border-slate-100 pt-6')}>
            <div className="label">
              Products or services <span className="text-rose-600">*</span>
            </div>
            <p className="mb-3 text-xs text-slate-500">Each item becomes retrievable business knowledge.</p>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">Description</th>
                    <th className="th w-28">Price</th>
                    <th className="th w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((p, idx) => (
                    <tr key={p.id}>
                      {(['name', 'description', 'price'] as const).map((k) => (
                        <td key={k} className="px-2 py-1.5">
                          <input
                            className="w-full rounded-md border border-transparent px-2 py-1.5 text-sm hover:border-slate-200 focus:border-brand-500 focus:outline-none"
                            value={p[k]}
                            placeholder={k === 'price' ? '$0' : ''}
                            onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, [k]: e.target.value } : x)))}
                          />
                        </td>
                      ))}
                      <td className="pr-2 text-right">
                        <button aria-label="Remove row" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => setItems([...items, { id: `p${Date.now()}`, name: '', description: '', price: '' }])}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                <Plus className="h-4 w-4" /> Add product or service
              </button>
            </div>
          </div>
        )}

        {step === 0 && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <VoicePicker voices={voices} toggle={toggleVoice} />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Who is your ideal customer?" required>
                <textarea rows={2} className="input" value={audience.who} onChange={(e) => setAudience({ ...audience, who: e.target.value })} />
              </Field>
            </div>
            <Field label="Service area">
              <input className="input" value={audience.radius} onChange={(e) => setAudience({ ...audience, radius: e.target.value })} />
            </Field>
            <Field label="What holds them back?">
              <input className="input" value={audience.pains} onChange={(e) => setAudience({ ...audience, pains: e.target.value })} />
            </Field>
          </div>
        )}

        {step === 3 && <VoicePicker voices={voices} toggle={toggleVoice} large />}

        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Progress is saved automatically. You can edit everything later.
          </span>
          <div className="flex gap-2">
            <Button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              Back
            </Button>
            <Button variant="primary" size="lg" onClick={next}>
              {step === steps.length - 1 ? 'Save profile' : 'Save and continue'}
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}

function VoicePicker({ voices, toggle, large }: { voices: string[]; toggle: (v: string) => void; large?: boolean }) {
  return (
    <div>
      <div className="label">Brand voice (pick up to 3)</div>
      <div className="flex flex-wrap gap-2">
        {brandVoices.map((v) => (
          <Chip key={v} selected={voices.includes(v)} onClick={() => toggle(v)}>
            {v}
          </Chip>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">{voices.length} of 3 selected{voices.length === 3 && ' — deselect one to choose another'}.</p>
      {large && (
        <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Sample in this voice</div>
          “New to lifting? You are exactly who we built Iron Peak for. Our coaches guide every rep — come try a free intro class.”
        </div>
      )}
    </div>
  );
}
