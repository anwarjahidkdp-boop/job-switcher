import Link from "next/link";
import {SiteHeader} from "@/components/SiteHeader";
import {SiteFooter} from "@/components/SiteFooter";
import {PageHead} from "@/components/PageHead";
import {InstallButton} from "@/components/InstallApp";
import {INSTALL_GUIDE} from "@/lib/pwa/install";
export const metadata={title:"Install or reinstall JobPao",description:"Install JobPao again on Android, iPhone or computer and sign in to your existing account."};
export default function InstallPage(){
 return <><SiteHeader inApp={false}/><main><div className="wrap">
  <PageHead kicker="Always available" title={<>Install or reinstall <span>JobPao</span></>} sub="Removed the app from your phone? You can install it again here."/>
  <div className="card panel install-page">
   <h2>Keep your account. Reinstall the app.</h2>
   <p>Your saved CV, career profile, preferences and application history are stored in your JobPao account. Removing the app or clearing browser storage does not delete those saved account records.</p>
   <div className="row"><InstallButton/><Link className="btn btn-ghost" href="/login?next=/inbox">Sign in to my existing account</Link></div>
   <p className="note small">Use the same email and sign-in method as before. You do not need a new account or a new CV upload. Unsaved edits may be lost. If you deleted your JobPao account, reinstalling will not restore it.</p>
   <h3>No install prompt? Use your browser menu.</h3>
   <p className="small muted">The browser controls when its install prompt appears. Open this page in Chrome on Android or Safari on iPhone if you are inside Facebook, Messenger or another app.</p>
   {Object.entries(INSTALL_GUIDE).map(([os,guide])=><details className="install-guide" key={os}><summary>{guide.title}</summary><ol>{guide.steps.map(step=><li key={step}>{step}</li>)}</ol></details>)}
   <p className="small muted">Already installed? Open JobPao from your home screen. This installation help stays available in the website footer and your Profile.</p>
  </div>
 </div></main><SiteFooter/></>;
}
