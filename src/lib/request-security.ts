/** Browser mutations must originate on this app. Provider webhooks authenticate separately. */
export function trustedMutation(req: Pick<Request,'method'|'url'|'headers'>): boolean {
 if(['GET','HEAD','OPTIONS'].includes(req.method.toUpperCase()))return true;
 if(req.headers.get('sec-fetch-site')==='cross-site')return false;
 const origin=req.headers.get('origin');
 if(!origin)return true; // Non-browser clients still need their endpoint's authentication.
 try{return new URL(origin).origin===new URL(req.url).origin && origin!=='null';}catch{return false;}
}
export class RequestTooLarge extends Error {}
/** Stream cap also works when Content-Length is missing or dishonest. */
export async function readLimitedText(req:Request,maxBytes:number):Promise<string>{
 if(Number(req.headers.get('content-length')||0)>maxBytes)throw new RequestTooLarge('Request too large');
 if(!req.body)return '';
 const reader=req.body.getReader(), decoder=new TextDecoder();let size=0,text='';
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new RequestTooLarge('Request too large');}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock();}
}
