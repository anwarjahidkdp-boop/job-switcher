import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { CvPreview } from './preview';
export const metadata={title:'Your CV and job matches',robots:{index:false,follow:false}};
export default function Page(){return <><SiteHeader inApp={false}/><main className="wrap"><CvPreview/></main><SiteFooter/></>;}
