import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { StartSearch } from './start';
export const metadata={title:'Build your job search'};
export default function GetStarted(){return <><SiteHeader inApp={false}/><main className="wrap"><StartSearch/></main><SiteFooter/></>;}
