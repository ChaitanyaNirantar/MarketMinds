import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Eye, HelpCircle, Lightbulb, Target, TrendingUp, X } from 'lucide-react';
import { CampaignTabs } from '../components/Layout';
import { Button, Card, PageHeader, StatusChip } from '../components/ui';
import { useApp } from '../store/AppStore';

const share = [
  { channel: 'Instagram', impressions: 63, members: 33 },
  { channel: 'Facebook', impressions: 29, members: 51 },
  { channel: 'LinkedIn', impressions: 9, members: 16 },
];

const blocks = [
  { icon: Eye, title: 'What happened', body: 'Instagram earned 63% of impressions but only 33% of new members. Facebook earned 29% of impressions and 51% of members.' },
  { icon: Lightbulb, title: 'Why it matters', body: 'Fewer impressions turned into more members on Facebook, so impressions alone are a poor guide to where to spend effort.' },
  { icon: Target, title: 'What to do next', body: 'Run a 30-day retention-and-referral campaign with more Facebook posts, and test testimonial posts against promo posts.' },
];

export default function Recommendation() {
  const { notify, pastRecommendations, acceptRecommendation } = useApp();
  const navigate = useNavigate();
  const [askOpen, setAskOpen] = useState(false);
  const [plan, setPlan] = useState({ goal: '40 repeat members and 20 referrals by Dec 20', mix: 'Facebook 50%, Instagram 30%, LinkedIn 20%', experiment: 'Testimonials vs. promos' });
  const [previewing, setPreviewing] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="AI recommendation"
        title="Recommendation for your next campaign"
        subtitle="Based on Fall Member Drive (Nov 1 – Nov 22)"
        right={<span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">Confidence: Medium</span>}
      />
      <CampaignTabs />

      <div className="grid gap-4 md:grid-cols-3">
        {blocks.map(({ icon: Icon, title, body }, i) => (
          <Card key={title} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {i + 1}. {title}
              </span>
            </div>
            <p className="text-[15px] leading-relaxed text-slate-800">{body}</p>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Evidence" subtitle="Share of impressions vs. share of members" className="lg:col-span-2">
          <div className="space-y-4 p-5">
            {share.map((s) => (
              <div key={s.channel}>
                <div className="mb-1.5 text-sm font-medium text-slate-700">{s.channel}</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-4 rounded bg-brand-200" style={{ width: `${s.impressions}%` }} />
                    <span className="text-xs tabular-nums text-slate-500">{s.impressions}% impressions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 rounded bg-brand-700" style={{ width: `${s.members}%` }} />
                    <span className="text-xs font-semibold tabular-nums text-slate-800">{s.members}% members</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex gap-4 pt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-brand-200" /> Impressions (light)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-brand-700" /> Members (dark)
              </span>
            </div>
          </div>
        </Card>

        <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Check before acting
          </div>
          <ul className="space-y-2 text-sm text-amber-900/90">
            <li>Only 3 weeks of data.</li>
            <li>Attribution is based on link tracking, not a controlled test.</li>
            <li>A test of testimonial vs. promo posts would raise confidence.</li>
          </ul>
        </div>
      </div>

      <Card title="Proposed next campaign" subtitle="Editable before use" className="mt-5">
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <label className="block">
            <span className="label">Goal</span>
            <input className="input" value={plan.goal} onChange={(e) => setPlan({ ...plan, goal: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Channels</span>
            <input className="input" value={plan.mix} onChange={(e) => setPlan({ ...plan, mix: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Experiment</span>
            <input className="input" value={plan.experiment} onChange={(e) => setPlan({ ...plan, experiment: e.target.value })} />
          </label>
        </div>
        {previewing && (
          <div className="mx-5 mb-5 grid grid-cols-4 gap-2 rounded-lg bg-slate-50 p-4 text-xs">
            {['Wk 1 · Welcome-back stories', 'Wk 2 · Bring-a-friend week', 'Wk 3 · Testimonial vs promo test', 'Wk 4 · Referral reward push'].map((w) => (
              <div key={w} className="rounded-md border border-slate-200 bg-white p-2 font-medium text-slate-700">
                {w}
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-slate-100 px-5 py-3">
          <button onClick={() => setPreviewing(!previewing)} className="text-sm font-medium text-brand-700 hover:underline">
            {previewing ? 'Hide plan preview' : 'Preview plan'}
          </button>
        </div>
      </Card>

      {askOpen && (
        <Card className="mt-5 border-brand-200 p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <HelpCircle className="h-4 w-4 text-brand-600" /> Why Facebook?
            </div>
            <button onClick={() => setAskOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-slate-700">
            Facebook converted 6.5 members per 1,000 impressions versus 1.9 on Instagram. Facebook posts in this campaign were mostly class walkthroughs and member Q&amp;A threads, which
            match the “coached, low-pressure” message from your testimonials. This is <b>attributed</b> data from link tracking, so it shows correlation, not proof.
          </p>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button
          variant="ghost"
          onClick={() => {
            notify('Recommendation dismissed');
            navigate('/dashboard');
          }}
        >
          Dismiss
        </Button>
        <Button icon={<HelpCircle className="h-4 w-4" />} onClick={() => setAskOpen(true)}>
          Ask why
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            void acceptRecommendation(`Get ${plan.goal} with a retention-and-referral campaign.`).then(() => {
              notify('Next campaign started from this recommendation');
              navigate('/goals/new');
            });
          }}
        >
          Accept and start next campaign <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <Card title="Past recommendations" className="mt-6">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Recommendation</th>
              <th className="th">Decision</th>
              <th className="th">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pastRecommendations.map((r) => (
              <tr key={r.rec}>
                <td className="td font-medium text-slate-900">{r.rec}</td>
                <td className="td">
                  <StatusChip status={r.decision} />
                </td>
                <td className="td">
                  {r.outcome !== '—' ? (
                    <span className="flex items-center gap-1 font-medium text-emerald-700">
                      <TrendingUp className="h-3.5 w-3.5" /> {r.outcome}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
