import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AIError, type AIProvider } from '../../../src/lib/ai/provider';
import { readHeldCirculars } from './circulars';

// A held bdjobstoday circular whose page labels are English and whose image is a Bangla circular.
const page = '<h1>KHULNA UNIVERSITY OF ENGINEERING AND TECHNOLOGY -KUET</h1><p>Position: Lecturer (Civil Engineering)</p><p>Application Deadline: 29 Nov, 2026</p><img src="https://www.bdjobstoday.com/adsimages/jobs1.jpg">';
const docs = [1, 2, 3].map(i => ({ id: `d${i}`, source_id: 's1', url: `https://www.bdjobstoday.com/hotjobs_details.php?id=${i}`, kind: 'article', attempts: 0, published_at: null }));
function db(): SupabaseClient {
  const chain = (data: unknown) => { const c: Record<string, unknown> = {}; for (const m of ['select', 'eq', 'lt', 'in', 'or', 'order']) c[m] = () => c; c.limit = async () => ({ data, error: null }); c.then = (r: (v: unknown) => unknown) => r({ data, error: null }); return c; };
  return { from: (t: string) => (t === 'ingestion_sources' ? chain([{ id: 's1', kind: 'bdweb', board_token: 'bdjobstoday', name: 'BDJobsToday' }]) : chain(docs)) } as unknown as SupabaseClient;
}
const fetcher = async (url: string) => url.endsWith('robots.txt') ? new Response('', { status: 404 }) : url.endsWith('.jpg') ? new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } }) : new Response(page, { headers: { 'content-type': 'text/html' } });
const BANGLA = 'খুলনা প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়\nনিয়োগ বিজ্ঞপ্তি\nপ্রভাষক (সিভিল ইঞ্জিনিয়ারিং) পদে প্রকৃত বাংলাদেশি নাগরিকদের নিকট থেকে অনলাইনে আবেদনপত্র আহ্বান করা যাচ্ছে।\nশিক্ষাগত যোগ্যতা: সংশ্লিষ্ট বিষয়ে বি.এসসি. ইঞ্জিনিয়ারিং ডিগ্রিতে প্রথম শ্রেণি। বয়স: ৩০ বছরের মধ্যে।\nআবেদন করতে হবে অনলাইনে, বিস্তারিত বিজ্ঞপ্তিতে দেখুন।';

// Readable, but names neither the post, the employer nor the deadline from the page.
const UNCONFIRMED = Array(4).fill('একটি প্রতিষ্ঠানে বিভিন্ন পদে অভিজ্ঞ প্রার্থীদের নিকট থেকে আবেদনপত্র আহ্বান করা যাচ্ছে। শিক্ষাগত যোগ্যতা ও অভিজ্ঞতার বিস্তারিত বিজ্ঞপ্তিতে দেওয়া আছে।').join('\n');

describe('reading held circulars', () => {
  it('publishes from the free reading without calling AI', async () => {
    const ai = { readImages: vi.fn(), generateJSON: vi.fn() } as unknown as AIProvider;
    const r = await readHeldCirculars(db(), ai, '2026-10-26', { limit: 3, dry: true, fetcher, ocr: async () => `${BANGLA}\nআবেদনের শেষ তারিখ: ২৯ নভেম্বর ২০২৬` });
    expect(r).toMatchObject({ freeRead: 3, read: 0, costMicroUsd: 0 });
    expect(ai.generateJSON).not.toHaveBeenCalled();
  });
  it('gives AI the free OCR text instead of paying to read the image, and counts failed calls against the budget', async () => {
    const generateJSON = vi.fn(async (req: { maxTokens?: number }) => { throw new Error(`Unterminated string in JSON (${req.maxTokens})`); });
    const ai = { readImages: vi.fn(), generateJSON } as unknown as AIProvider;
    // No deadline in the OCR text, so the free reading cannot confirm it and AI is asked.
    const r = await readHeldCirculars(db(), ai, '2026-10-26', { limit: 3, maxCostMicroUsd: 90_000, dry: true, fetcher, ocr: async () => UNCONFIRMED });
    expect(ai.readImages).not.toHaveBeenCalled();
    expect(generateJSON.mock.calls[0][0]).toMatchObject({ maxTokens: 8000 });
    // Two failed calls at the $0.05 estimate pass the $0.09 budget, so the third circular waits.
    expect(r).toMatchObject({ read: 2, costMicroUsd: 100_000 });
  });
  it('uses the reported cost of a failed call when the provider gives it', async () => {
    const generateJSON = vi.fn(async () => { throw new AIError('invalid_json', undefined, { model: 'm', inputTokens: 1, outputTokens: 1, costMicroUsd: 7 }); });
    const r = await readHeldCirculars(db(), { readImages: vi.fn(), generateJSON } as unknown as AIProvider, '2026-10-26', { limit: 3, dry: true, fetcher, ocr: async () => UNCONFIRMED });
    expect(r.costMicroUsd).toBe(21);
  });
});
