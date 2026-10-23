import type { SupabaseClient } from '@supabase/supabase-js';
import { jobToRow } from '../../../src/lib/jobs';
import type { IngestedJob } from '../../../src/lib/ingest/ats';
import type { SourceRow } from '../fetch-source';
import { BD_SOURCES, approvedSource } from './registry';
import { canonicalIdentity } from './identity';
import type { BangladeshBatch } from './fetch';
import type { DiscoveredJob } from './parse';
import { sourceReviewReason } from './quality';
import { todayStr } from '../../../src/lib/dates';

/** Register new sources once; preserve any later administrator disable decision. */
export async function ensureBangladeshSources(db: SupabaseClient) {
  const { data, error } = await db.from('ingestion_sources').select('board_token').eq('kind', 'bdweb');
  if (error) throw error;
  const known = new Set((data || []).map(s => s.board_token));
  const rows = BD_SOURCES.filter(s => !known.has(s.key)).map(s => ({
    kind: 'bdweb', board_token: s.key, name: s.name, url: s.url, country: 'BD',
    company: s.company || null, source_type: s.type, active: s.enabled && approvedSource(s),
    last_status: !approvedSource(s) ? 'quality_review' : s.enabled ? 'pending' : 'access_required', last_error: s.note || null,
  }));
  if (rows.length) { const { error } = await db.from('ingestion_sources').insert(rows); if (error) throw error; }
}

export async function persistBangladeshJobs(db: SupabaseClient, src: SourceRow, jobs: IngestedJob[], today = todayStr('Asia/Dhaka')) {
  if (src.kind === 'bdweb') {
    const configured = BD_SOURCES.find(s => s.key === src.board_token);
    if (!configured || !configured.enabled || !approvedSource(configured)) throw new Error('Source quality review required before publishing');
    for (const job of jobs) { const reason = sourceReviewReason(job, configured, today); if (reason) throw new Error(`Listing review required: ${reason}`); }
  }
  const rows = jobs.map(j => {
    const discovery = (j as Partial<DiscoveredJob>).discovery;
    return { canonical_key: canonicalIdentity(j, src.id),
      discovered_url: discovery?.url || j.url || src.url,
      original_url: discovery?.originalUrl || (src.kind === 'brac' ? j.url : null),
      evidence: discovery?.evidence || 'structured',
      data: jobToRow(j, { owner_id: null, source_kind: src.kind, source_id: src.id, external_id: j.externalId, description: j.description.slice(0, 20000) }),
    };
  });
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.rpc('ingest_public_jobs', { p_source: src.id, p_rows: rows.slice(i, i + 200) });
    if (error) throw error;
  }
}

/** Preserve unresolved circulars for review, and retry transient detail fetch failures next run. */
export async function persistBangladeshBatch(db: SupabaseClient, src: SourceRow, batch: BangladeshBatch) {
  if (batch.checkedUrls.length) {
    for (let i = 0; i < batch.checkedUrls.length; i += 100) {
      const { error } = await db.from('source_documents').update({ state: 'processed', last_seen_at: new Date().toISOString() }).eq('source_id', src.id).in('url', batch.checkedUrls.slice(i, i + 100));
      if (error) throw error;
    }
  }
  const docs = [...new Map(batch.documents.map(d => [d.url, d])).values()].map(d => ({
    source_id: src.id, url: d.url, title: d.title, kind: d.kind, state: d.state,
    reason: d.reason, published_at: d.publishedAt, last_seen_at: new Date().toISOString(),
  }));
  for (let i = 0; i < docs.length; i += 100) {
    const { error } = await db.from('source_documents').upsert(docs.slice(i, i + 100), { onConflict: 'source_id,url' });
    if (error) throw error;
  }
  const { error } = await db.from('ingestion_sources').update({ cursor_url: batch.nextUrl }).eq('id', src.id);
  if (error) throw error;
}
