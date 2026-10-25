import React from 'react';
import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.stubGlobal('React',React);
vi.mock('next/navigation',()=>({usePathname:()=>'/install',useRouter:()=>({back:vi.fn()})}));
import InstallPage from './page';
it('renders a permanent public install entry and account recovery guidance without a native prompt',()=>{
 const oldFlag=vi.fn(()=>'1');vi.stubGlobal('localStorage',{getItem:oldFlag});
 const html=renderToStaticMarkup(<InstallPage/>);
 expect(html).toContain('Install JobPao');expect(html).toContain('>Install app<');
 expect(html).toContain('same email and sign-in method');
 expect(html).toContain('Removing the app or clearing browser storage does not delete');
 expect(html).toContain('reinstalling will not restore it');
 expect(html).toContain('Install on Android');expect(html).toContain('Install on iPhone');
 expect(oldFlag).not.toHaveBeenCalled();
});
