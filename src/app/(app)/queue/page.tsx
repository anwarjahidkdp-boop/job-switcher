import { PageHead } from '@/components/PageHead';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAppState } from '@/lib/server/page';
import { applyQueue } from '@/lib/apply-queue';
export const metadata={title:'Ready to Apply'};
export default async function Queue(){
 const {st}=await requireAppState('/queue');
 const first=applyQueue(st)[0];
 if(first)redirect(`/jobs/${first.job.id}`);
 return <><PageHead title="Ready to Apply"/><div className="card panel"><p>No eligible opportunity is ready yet. Review your matches and application requirements.</p><Link prefetch={false} className="btn btn-primary" href="/inbox#matches">View opportunities</Link><Link prefetch={false} className="btn btn-ghost" href="/profile">Review my details</Link></div></>;
}
