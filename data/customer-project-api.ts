import { DEV_PROJECT_REF, type CustomerProjectPort, type ProjectRow, type Session } from './customer-project-sync';
import { boundedCloudFetch } from './customer-cloud-locks';
type AuthSession = Session & {accessToken: string};
// No global fetch and no Auth creation: future approved composition must supply both.
export function prepareCustomerProjectApi(options: {
  enabled?: boolean; url: string; publishableKey: string;
  session: () => Promise<AuthSession>; request: typeof fetch; signal?:()=>AbortSignal|undefined;
}): CustomerProjectPort {
  if(options.url !== `https://${DEV_PROJECT_REF}.supabase.co` || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(options.publishableKey))throw Error('invalid-public-client-config');
  let owner: string | undefined;
  async function session() {
    if(options.enabled!==true)throw Error('cloud-save-disabled');
    const s=await options.session();
    if(!s.anonymous||s.expiresAt<=Date.now()+60000||!s.accessToken||owner&&owner!==s.userId)throw Error('invalid-session');
    owner=s.userId;return s;
  }
  async function call(method: string, id: string, expectedOwner: string, body?: unknown, revision?: string) {
    const s=await session();if(s.userId!==expectedOwner)throw Error('owner-mismatch');
    const query=new URLSearchParams({select:'*',id:`eq.${id}`,owner_user_id:`eq.${expectedOwner}`});
    if(revision)query.set('revision',`eq.${revision}`);
    let response;
    try {response=await boundedCloudFetch(options.request,`${options.url}/rest/v1/projects${method==='POST'?'':`?${query}`}`,{
      method,redirect:'error',cache:'no-store',headers:{apikey:options.publishableKey,Authorization:`Bearer ${s.accessToken}`,'Content-Type':'application/json',Prefer:'return=representation'},
      ...(body===undefined?{}:{body:JSON.stringify(body)})},options.signal?.());
    } catch {throw Error('network-failure');}
    if(!response.ok)throw Error(response.status===401?'authentication-failed':response.status===409?'insert-conflict':'project-request-failed');
    const rows: unknown=await response.json();if(!Array.isArray(rows)||rows.length>1)throw Error('unexpected-project-response');
    if(rows.length===0)return null;
    const row=rows[0];
    if(row.id!==id||row.owner_user_id!==expectedOwner||!(typeof row.revision==='string'&&/^[1-9][0-9]*$/.test(row.revision)||Number.isSafeInteger(row.revision)&&row.revision>0))throw Error('invalid-project-response');
    return {...row,revision:String(row.revision)} as ProjectRow;
  }
  return {session,
    async insert(row){const result=await call('POST',row.id,row.owner_user_id,row);if(!result)throw Error('missing-insert-result');return result;},
    update:(id,user,revision,content)=>call('PATCH',id,user,content,revision),
    get:(id,user)=>call('GET',id,user),
  };
}
