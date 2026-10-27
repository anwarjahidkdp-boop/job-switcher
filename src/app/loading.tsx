import Loading from "./(app)/loading";
import { Logo } from "@/components/ui";

// The first screen while the app opens: the JobPao bar at once, so it never looks like a blank page.
export default function AppLoading(){return <><div className="top" aria-hidden="true"><div className="wrap"><span className="brand"><Logo /><span>Job<span className="brand-pao">Pao</span></span></span></div></div><main className="wrap" aria-label="Loading JobPao"><Loading/></main></>;}
