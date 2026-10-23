export type InstallPrompt = Event & { prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}> };
export type InstallOs="ios"|"android"|"desktop";
export function installOs(ua:string,platform:string,touches:number):InstallOs{
 return /iPhone|iPad|iPod/i.test(ua)||(platform==="MacIntel"&&touches>1)?"ios":/Android/i.test(ua)?"android":"desktop";
}
export const INSTALL_GUIDE:Record<InstallOs,{title:string;steps:string[]}>={
 android:{title:"Install on Android",steps:["Open jobpao.app in Chrome, not inside Facebook or Messenger.","Tap the Chrome ⋮ menu at the top right.","Choose Install app or Add to Home screen, then confirm Install."]},
 ios:{title:"Install on iPhone",steps:["Open jobpao.app in Safari.","Tap Share, then Add to Home Screen (you may need to scroll).","Tap Add."]},
 desktop:{title:"Install on your computer",steps:["Open jobpao.app in Chrome or Edge.","Click the install icon in the address bar, or use the browser menu's install option.","Confirm Install."]}
};
/** A prompt can be consumed once. Permanent help remains usable without a browser prompt. */
export function createInstaller(options:{showGuide:()=>void;onInstalled:()=>void}){
 let deferred:InstallPrompt|null=null;
 let confirmed=false;
 const finish=()=>{confirmed=true;deferred=null;options.onInstalled();};
 return{
  capture(event:InstallPrompt){event.preventDefault();confirmed=false;deferred=event;},
  isInstalled(){return confirmed;},
  installed:finish,
  async request(){
   const event=deferred;deferred=null;
   if(!event){options.showGuide();return;}
   try{await event.prompt();const {outcome}=await event.userChoice;if(outcome==="accepted")finish();else options.showGuide();}
   catch{options.showGuide();}
  }
 };
}
