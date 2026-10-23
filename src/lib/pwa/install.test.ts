import {expect,it,vi} from 'vitest';
import {createInstaller,installOs,type InstallPrompt} from './install';
function setup(){
 const showGuide=vi.fn(),onInstalled=vi.fn();
 return{showGuide,onInstalled,installer:createInstaller({showGuide,onInstalled})};
}
function prompt(outcome:"accepted"|"dismissed"="accepted"){
 return{preventDefault:vi.fn(),prompt:vi.fn(async()=>{}),userChoice:Promise.resolve({outcome})} as unknown as InstallPrompt;
}
it('keeps manual reinstall help usable when no native prompt arrives',async()=>{
 const s=setup();await s.installer.request();await s.installer.request();
 expect(s.showGuide).toHaveBeenCalledTimes(2);expect(s.onInstalled).not.toHaveBeenCalled();
});
it('consumes a prompt once and accepts a fresh prompt after a later uninstall',async()=>{
 const s=setup(),first=prompt();s.installer.capture(first);await s.installer.request();
 expect(first.preventDefault).toHaveBeenCalled();expect(first.prompt).toHaveBeenCalledTimes(1);expect(s.onInstalled).toHaveBeenCalledTimes(1);
 await s.installer.request();expect(s.showGuide).toHaveBeenCalledTimes(1);
 const reinstall=prompt();s.installer.capture(reinstall);await s.installer.request();
 expect(reinstall.prompt).toHaveBeenCalledTimes(1);expect(s.onInstalled).toHaveBeenCalledTimes(2);
});
it('offers help after rejection or dismissal instead of permanently hiding installation',async()=>{
 for(const fails of [false,true]){
  const s=setup(),event=prompt('dismissed');
  if(fails)vi.mocked(event.prompt).mockRejectedValueOnce(new Error('prompt unavailable'));
  s.installer.capture(event);await s.installer.request();
  expect(s.showGuide).toHaveBeenCalledOnce();expect(s.onInstalled).not.toHaveBeenCalled();
 }
});
it('selects instructions for Android, iPhone, iPad desktop mode and desktop',()=>{
 expect(installOs('Android','Linux',1)).toBe('android');
 expect(installOs('iPhone','iPhone',1)).toBe('ios');
 expect(installOs('Macintosh','MacIntel',5)).toBe('ios');
 expect(installOs('Linux','Linux',0)).toBe('desktop');
});
