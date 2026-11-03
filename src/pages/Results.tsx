import clsx from 'clsx';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, FlaskConical, Keyboard } from 'lucide-react';
import { CampaignTabs } from '../components/Layout';
import { Button, Card, Field, PageHeader, PlatformTag, Select, StatusChip } from '../components/ui';
import { channelResults, sampleResults, type ChannelResult, type ResultSource } from '../data/mock';
import { useApp } from '../store/AppStore';

type Method = 'import' | 'type' | 'sample';
const numericCols = ['impressions', 'clicks', 'leads', 'members'] as const;

export default function Results() {
  const { results, setResults, notify } = useApp();
  const [campaign, setCampaign] = useState('Fall Member Drive');
  const [method, setMethod] = useState<Method>('import');
  const [rows, setRows] = useState<ChannelResult[]>(results);
  const [visits, setVisits] = useState(540);
  const [leads, setLeads] = useState(118);
  const [webSource, setWebSource] = useState<ResultSource | ''>('Imported');
  const [touched, setTouched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const choose = (m: Method) => {
    setMethod(m);
    if (m === 'sample') {
      setRows(sampleResults);
      setWebSource('Sample');
    } else if (m === 'import') {
      fileRef.current?.click();
    }
  };

  const methods: { id: Method; icon: typeof FileUp; title: string; body: string }[] = [
    { id: 'import', icon: FileUp, title: 'Import a file', body: 'CSV of channel or post metrics.' },
    { id: 'type', icon: Keyboard, title: 'Type values', body: 'Edit the cells below.' },
    { id: 'sample', icon: FlaskConical, title: 'Labeled sample', body: 'Fills the table and tags every row Sample.' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Fall Member Drive"
        title="Enter or import results"
        subtitle="Put numbers on the campaign before the dashboard reads them."
        right={<Select value={campaign} onChange={setCampaign} options={['Fall Member Drive', 'Referral Push', 'Holiday Promo']} />}
      />
      <CampaignTabs />

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={() => {
          setRows(channelResults);
          setWebSource('Imported');
          notify('CSV imported: 3 channel rows');
        }}
      />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {methods.map(({ id, icon: Icon, title, body }) => (
          <button
            key={id}
            onClick={() => choose(id)}
            className={clsx(
              'relative rounded-xl border bg-white p-4 text-left shadow-card transition',
              method === id ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-slate-200 hover:border-slate-300',
            )}
          >
            <Icon className={clsx('h-5 w-5', method === id ? 'text-brand-600' : 'text-slate-400')} />
            <div className="mt-2 text-sm font-semibold text-slate-900">{title}</div>
            <div className="text-xs text-slate-500">{body}</div>
            {method === id && <span className="absolute right-3 top-3 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">In use</span>}
          </button>
        ))}
      </div>

      <Card title="Channel results" className="mb-5">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Channel</th>
              <th className="th text-right">Impressions</th>
              <th className="th text-right">Clicks</th>
              <th className="th text-right">Leads</th>
              <th className="th text-right">Members</th>
              <th className="th">Where it came from</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, idx) => (
              <tr key={r.channel}>
                <td className="td">
                  <PlatformTag platform={r.channel} full />
                </td>
                {numericCols.map((k) => (
                  <td key={k} className="px-2 py-1.5 text-right">
                    <input
                      type="number"
                      value={r[k]}
                      readOnly={r.source === 'Connected'}
                      onChange={(e) => {
                        setMethod('type');
                        setRows(rows.map((x, i) => (i === idx ? { ...x, [k]: Number(e.target.value), source: x.source === 'Sample' ? 'Sample' : 'Typed' } : x)));
                      }}
                      className={clsx(
                        'w-24 rounded-md border px-2 py-1.5 text-right text-sm tabular-nums focus:border-brand-500 focus:outline-none',
                        r.source === 'Connected' ? 'border-transparent bg-transparent text-slate-500' : 'border-slate-200 bg-white',
                      )}
                    />
                  </td>
                ))}
                <td className="td">
                  <StatusChip status={r.source} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">What the labels mean: </span>
          <b>Connected</b> = read from a linked account. <b>Imported</b> = from a file you uploaded. <b>Typed</b> = entered by hand. <b>Sample</b> = illustrative demo data. Sample
          rows stay tagged and are never marked Observed on Analytics.
        </div>
      </Card>

      <Card title="Website outcomes">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Landing visits">
            <input type="number" className="input" value={visits} onChange={(e) => setVisits(Number(e.target.value))} />
          </Field>
          <Field label="Trial form leads">
            <input type="number" className="input" value={leads} onChange={(e) => setLeads(Number(e.target.value))} />
          </Field>
          <Field label="Where it came from" required error={touched && !webSource ? 'Pick where these numbers came from.' : ''}>
            <select className="input" value={webSource} onBlur={() => setTouched(true)} onChange={(e) => setWebSource(e.target.value as ResultSource)}>
              <option value="">Select…</option>
              <option>Connected</option>
              <option>Imported</option>
              <option>Typed</option>
              <option>Sample</option>
            </select>
          </Field>
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto text-xs text-slate-500">Saving updates Dashboard and Analytics. It does not publish anything.</span>
        <Button onClick={() => navigate('/campaigns/7')}>Cancel</Button>
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            setTouched(true);
            if (!webSource) return;
            setResults(rows);
            notify('Results saved');
            navigate('/campaigns/7/analytics');
          }}
        >
          Save results
        </Button>
      </div>
    </>
  );
}
