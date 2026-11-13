export interface Evidence {
  citation_id: string;
  chunk_id: number;
  source_id: string;
  source: string;
  location: string;
  text: string;
  score: number;
}
export interface Idea {
  title: string;
  rationale: string;
  audience: string;
  supporting_facts: { claim: string; citation_id: string; quote: string }[];
  proposed_actions: string[];
  assumptions: string[];
  success_metrics: string[];
  risks: string[];
}
export interface AIJob {
  id: string;
  kind: 'index' | 'strategy' | 'recommendation';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'invalidated';
  stage: string;
  error: string;
  goal_id: string | null;
  campaign_id: string | null;
  accepted: boolean;
  stale?: boolean;
  model: string;
  latency_ms: number | null;
  output: { status?: 'ready' | 'needs_information'; observations?: { channel: string; metric: string; value: number; source: string }[]; ideas?: Idea[]; conflicts?: string[]; missing_information?: string[] };
  evidence: Evidence[];
  results?: { channel: string; impressions: number; clicks: number; leads: number; members: number; source: string }[];
}
export interface Readiness { ready: boolean; indexed_sources: number; missing: string[]; note: string }
