import type { ReactNode } from "react";
const paths = {
  country: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/></>,
  skills: <><path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z"/></>,
  review: <><path d="M9 5H5v16h14V5h-4M9 3h6v4H9zM8 14l3 3 5-6"/></>,
  preferences: <><path d="M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6"/></>,
  application: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
  sites: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01M7 13h10M7 16h6"/></>,
  email: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>,
  reminders: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  data: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
};
export function ProfileCardTitle({icon,children}:{icon:keyof typeof paths;children:ReactNode}) {
 return <h3 className="profile-card-title"><span className="profile-card-icon"><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[icon]}</svg></span><span>{children}</span></h3>;
}
