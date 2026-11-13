import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, Download, ExternalLink, Loader2, Lock, Plug, Send, X } from 'lucide-react';
import { Button, Card, PageHeader, PlatformTag, StatusChip } from '../components/ui';
import { PLATFORMS, type AccountDetail, type Platform } from '../data/mock';
import { useApp } from '../store/AppStore';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dates = [2, 3, 4, 5, 6, 7, 8];

export default function Schedule() {
  const {
    accounts,
    accountDetails,
    connect,
    disconnect,
    listTargets,
    selectTarget,
    posts,
    retryPost,
    publishNow,
    movePost,
    content,
    scheduleApproved,
    notify,
  } = useApp();
  const [dragId, setDragId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ platform: Platform; targets: { id: string; name: string }[] } | null>(null);
  const [params, setParams] = useSearchParams();

  // Coming back from Facebook / Instagram sign-in.
  useEffect(() => {
    const connected = params.get('connected');
    const pick = params.get('pick') as Platform | null;
    const error = params.get('error');
    if (!connected && !pick && !error) return;
    setParams({}, { replace: true });
    if (connected) notify(`${connected} connected`);
    if (error) notify(`Could not connect: ${error}`);
    if (pick) {
      listTargets(pick)
        .then((targets) => setPicker({ platform: pick, targets }))
        .catch((e: Error) => notify(e.message));
    }
  }, [params, setParams, notify, listTargets]);

  const startConnect = async (p: Platform) => {
    setConnecting(p);
    try {
      const how = await connect(p);
      if (how === 'demo') {
        notify(`${p} connected (demo)`);
        setConnecting(null);
      }
      // 'redirect': the browser is leaving for the platform's sign-in page.
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not start sign-in');
      setConnecting(null);
    }
  };

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
            <AccountCard
              key={p}
              platform={p}
              connected={accounts[p]}
              detail={accountDetails[p]}
              busy={connecting === p}
              onConnect={() => startConnect(p)}
              onPick={() =>
                listTargets(p)
                  .then((targets) => setPicker({ platform: p, targets }))
                  .catch((e: Error) => notify(e.message))
              }
              onDisconnect={() => {
                void disconnect(p).then(() => notify(`${p} disconnected`));
              }}
            />
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
                    {p.status === 'Published' &&
                      (p.permalink ? (
                        <a
                          href={p.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <Button size="sm" variant="ghost">
                          View
                        </Button>
                      ))}
                    {p.status === 'Scheduled' && accountDetails[p.platform]?.live && accounts[p.platform] ? (
                      <Button
                        size="sm"
                        icon={publishing === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        disabled={publishing !== null}
                        onClick={async () => {
                          setPublishing(p.id);
                          try {
                            const res = await publishNow(p.id);
                            notify(res.published ? `Published to ${p.platform}` : `Not published: ${res.error ?? 'unknown error'}`);
                          } catch (e) {
                            notify(e instanceof Error ? e.message : 'Publish failed');
                          } finally {
                            setPublishing(null);
                          }
                        }}
                      >
                        Publish now
                      </Button>
                    ) : (
                      p.status === 'Scheduled' && (
                        <Button size="sm" variant="ghost">
                          Edit
                        </Button>
                      )
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
            <AlertTriangle className="h-3.5 w-3.5" /> Some posts failed because an account is disconnected. Reconnect{' '}
            {[...new Set(failed.filter((f) => !accounts[f.platform]).map((f) => f.platform))].join(' and ')}, then retry.
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
      {picker && (
        <PagePicker
          platform={picker.platform}
          targets={picker.targets}
          onClose={() => setPicker(null)}
          onPick={async (id) => {
            await selectTarget(picker.platform, id);
            setPicker(null);
            notify(`${picker.platform} connected`);
          }}
        />
      )}
    </>
  );
}

function AccountCard({
  platform,
  connected,
  detail,
  busy,
  onConnect,
  onPick,
  onDisconnect,
}: {
  platform: Platform;
  connected: boolean;
  detail?: AccountDetail;
  busy: boolean;
  onConnect: () => void;
  onPick: () => void;
  onDisconnect: () => void;
}) {
  const needsPick = detail?.status === 'needs_target';
  const expired = detail?.status === 'expired';
  const demoButLiveAvailable = connected && detail?.canConnectLive && !detail.live;
  const daysLeft = detail?.expiresAt ? Math.round((new Date(detail.expiresAt).getTime() - Date.now()) / 86_400_000) : null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <PlatformTag platform={platform} full />
        {connected ? (
          <StatusChip status="Connected" />
        ) : needsPick ? (
          <Button size="sm" variant="primary" onClick={onPick}>
            Choose Page
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon={<Plug className="h-3.5 w-3.5" />} onClick={onConnect} disabled={busy}>
            {busy ? 'Opening…' : expired ? 'Reconnect' : 'Connect'}
          </Button>
        )}
      </div>
      {(connected || expired) && (
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="flex min-w-0 items-center gap-1.5">
            {connected && (
              <span
                className={clsx(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  detail?.live ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                )}
                title={detail?.live ? 'A real account. Posts are really published.' : 'Demo connection. Nothing is posted.'}
              >
                {detail?.live ? 'Live' : 'Demo'}
              </span>
            )}
            <span
              className="truncate"
              title={demoButLiveAvailable ? 'Disconnect, then connect your real account.' : undefined}
            >
              {expired ? (
                <span className="text-rose-700">Sign-in expired. Reconnect.</span>
              ) : demoButLiveAvailable ? (
                'Disconnect to use your real account'
              ) : detail?.live ? (
                <>
                  {detail.name}
                  {daysLeft !== null && daysLeft <= 14 && <span className="text-amber-700"> · renews in {Math.max(daysLeft, 0)}d</span>}
                </>
              ) : null}
            </span>
          </span>
          {connected && (
            <button onClick={onDisconnect} className="shrink-0 font-medium text-slate-500 hover:text-rose-700 hover:underline">
              Disconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PagePicker({
  platform,
  targets,
  onPick,
  onClose,
}: {
  platform: Platform;
  targets: { id: string; name: string }[];
  onPick: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={`Choose a ${platform} Page`}>
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Which {platform} Page should MarketMinds post as?</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {targets.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">No Pages found that you can post to.</li>}
          {targets.map((t) => (
            <li key={t.id}>
              <button
                disabled={saving !== null}
                onClick={async () => {
                  setSaving(t.id);
                  try {
                    await onPick(t.id);
                  } finally {
                    setSaving(null);
                  }
                }}
                className="flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <span className="font-medium text-slate-800">{t.name}</span>
                {saving === t.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
