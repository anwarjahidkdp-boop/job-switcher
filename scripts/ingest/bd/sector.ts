// Private-sector jobs are JobPao's main audience in Bangladesh, so held circulars from private employers are read first
// (the day's AI budget can run out). A title is treated as government when it names a public body; everything else,
// including unclear titles, counts as private. This only orders the reading queue: no circular is dropped.
const GOV = /মন্ত্রণালয়|মন্ত্রণালয়|অধিদপ্তর|অধিদফতর|পরিদপ্তর|সরকারি|সরকারী|কার্যালয়|কার্যালয়|জেলা প্রশাসক|উপজেলা|পৌরসভা|সিটি কর্পোরেশন|কর্পোরেশন|কর্তৃপক্ষ|বোর্ড|পরিষদ|কমিশন|সেনাবাহিনী|নৌবাহিনী|বিমান বাহিনী|পুলিশ|আনসার|বিজিবি|কোস্ট গার্ড|ফায়ার সার্ভিস|রেলওয়ে|বাংলাদেশ ব্যাংক|সোনালী ব্যাংক|জনতা ব্যাংক|অগ্রণী ব্যাংক|রূপালী ব্যাংক|কৃষি ব্যাংক|বিশ্ববিদ্যালয় মঞ্জুরি|শিক্ষা বোর্ড|সরকারি কলেজ|মেডিকেল কলেজ হাসপাতাল|ministry|directorate|department of|govt\.?|government|city corporation|corporation|authority|\bboard\b|commission|bangladesh (?:army|navy|air force|police|railway|bank)\b|\b(?:bgb|ansar|rab|dgfi|nsi|bpsc|psc|ntrca|bcs)\b|sonali bank|janata bank|agrani bank|rupali bank|krishi bank|teletalk|power development board|titas gas/i;

export const governmentTitle = (title: string | null | undefined) => GOV.test(String(title || '').normalize('NFC'));

/** Private-employer circulars first, keeping each group's own order. */
export function privateFirst<T extends { title?: string | null }>(docs: T[]): T[] {
  return [...docs.filter((d) => !governmentTitle(d.title)), ...docs.filter((d) => governmentTitle(d.title))];
}
