import clsx from 'clsx';
import { useState } from 'react';
import { AlertTriangle, CalendarCheck, Download, Lock, Plug } from 'lucide-react';
import { Button, Card, PageHeader, PlatformTag, StatusChip } from '../components/ui';
import { PLATFORMS, type Platform } from '../data/mock';
import { useApp } from '../store/AppStore';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dates = [2, 3, 4, 5, 6, 7, 8];

export default function Schedule() {
  const { accounts, connect, posts, retryPost, movePost, content, scheduleApproved, notify } = useApp();
  const [dragId, setDragId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<Platform | null>(null);

  const scheduledTitles = new Set(posts.map((p) => p.title));
  const approvedPending = content.filter((c) => c.status === 'Approved' && !scheduledTitles.has(c.topic));
  const failed = posts.filter((p) => p.status === 'Failed');

  const exportCsv = () => {
    const rows = content.filter((c) => c.status === 'Approved');
    const csv = ['topic,platform,format,caption', ...rows.map((r) => [r.topic, r.platform, r.format, `"${r.caption.replace(/"/g, '""')}"`].join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'approved-posts.csv';
    a.click();
    URL.revokeObjectURL(url);
    notify(`Exported ${rows.length} approved posts (not marked published)`);
  };

  return (
    <>
      <PageHeader title="Schedule and publish" subtitle="Only approved posts can be scheduled. Every attempt and failure is logged with a way to recover." />

      <Card title="Connected accounts" className="mb-5">
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {PLATFORMS.map((p) => (
            <div key={p} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <PlatformTag platform={p} full />
              {accounts[p] ? (
                <StatusChip status="Connected" />
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plug className="h-3.5 w-3.5" />}
                  onClick={async () => {
                    setConnecting(p);
                    try {
                      await connect(p);
                      notify(`${p} connected`);
                    } finally {
                      setConnecting(null);
                    }
                  }}
                >
                  {connecting === p ? 'Opening…' : 'Connect'}
                </Button>
              )}
            </div>
          ))}
        </div>
        <p className="flex items-center gap-1.5 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5" /> Sign-in happens on the platform's own page (OAuth). We never see or store your password.
        </p>
      </Card>

      <Card title="Week of Nov 2" subtitle="Drag a post to another day to reschedule" className="mb-5">
        <div className="grid grid-cols-7 divide-x divide-slate-100">
          {days.map((d, i) => (
            <div
              key={d}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) movePost(dragId, i);
                setDragId(null);
              }}
              className={clsx('min-h-[170px] p-2', dragId && 'bg-brand-50/40')}
            >
              <div className="mb-2 text-center">
                <div className="text-xs font-semibold uppercase text-slate-500">{d}</div>
                <div className="text-sm font-semibold tabular-nums text-slate-800">{dates[i]}</div>
              </div>
              <div className="space-y-2">
                {posts
                  .filter((p) => p.day === i)
                  .map((p) => (
                    <div
                      key={p.id}
                      draggable={p.status === 'Scheduled'}
                      onDragStart={() => setDragId(p.id)}
                      className={clsx(
                        'rounded-lg border p-2 text-xs',
                        p.status === 'Failed' ? 'border-2 border-dashed border-rose-400 bg-rose-50' : p.status === 'Published' ? 'border-emerald-200 bg-emerald-50' : 'cursor-grab border-slate-200 bg-white shadow-sm',
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <PlatformTag platform={p.platform} />
                        <span className="tabular-nums text-slate-500">{p.time}</span>
                      </div>
                      <div className="mt-1.5 line-clamp-2 font-medium text-slate-800">{p.title}</div>
                      <div className="mt-1.5">
                        <StatusChip status={p.status} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Publication log">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Post</th>
              <th className="th">Platform</th>
              <th className="th">Time</th>
              <th className="th">Status</th>
              <th className="th text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...posts]
              .sort((a, b) => (a.status === 'Failed' ? -1 : b.status === 'Failed' ? 1 : a.day - b.day))
              .map((p) => (
                <tr key={p.id} className={clsx(p.status === 'Failed' && 'bg-rose-50/40')}>
                  <td className="td">
                    <div className="font-medium text-slate-900">{p.title}</div>
                    {p.error && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-rose-700">
                        <AlertTriangle className="h-3.5 w-3.5" /> Failed: {p.error}
                      </div>
                    )}
                  </td>
                  <td className="td">
                    <PlatformTag platform={p.platform} full />
                  </td>
                  <td className="td tabular-nums">
                    {p.date}, {p.time}
                  </td>
                  <td className="td">
                    <StatusChip status={p.status} />
                  </td>
                  <td className="td text-right">
                    {p.status === 'Published' && (
                      <Button size="sm" variant="ghost">
                        View
                      </Button>
                    )}
                    {p.status === 'Scheduled' && (
                      <Button size="sm" variant="ghost">
                        Edit
                      </Button>
                    )}
                    {p.status === 'Failed' && (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={!accounts[p.platform]}
                        title={!accounts[p.platform] ? `Reconnect ${p.platform} first` : undefined}
                        onClick={() => {
                          retryPost(p.id);
                          notify('Retry queued');
                        }}
                      >
                        Retry
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {failed.some((f) => !accounts[f.platform]) && (
          <p className="flex items-center gap-1.5 border-t border-dashed border-rose-200 bg-rose-50/60 px-5 py-3 text-xs text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" /> Failed: token expired. Reconnect Facebook, then retry.
          </p>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto text-xs text-slate-500">Exported rows are not marked published. Use export when an API connection is unavailable.</span>
        <Button icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
          Export approved
        </Button>
        <Button
          variant="primary"
          size="lg"
          icon={<CalendarCheck className="h-4 w-4" />}
          disabled={approvedPending.length === 0}
          onClick={() => {
            void scheduleApproved().then((n) => notify(`${n} approved posts scheduled`));
          }}
        >
          Schedule approved ({approvedPending.length})
        </Button>
      </div>
    </>
  );
}
