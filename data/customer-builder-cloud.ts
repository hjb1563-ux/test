import { CUSTOMER_CLOUD_SAVE_ENABLED, DEV_PROJECT_REF, type ProjectRow } from './customer-project-sync';
import { createAnonymousSessionProvider } from './customer-anonymous-auth';
import { prepareCustomerProjectApi } from './customer-project-api';
import { CustomerProjectBinding, rotateCustomerProject } from './customer-project-binding';
import { STORAGE, readProject, type LocalProject } from './bathroom-consultation';
import {customerTestContext,journaledCustomerFetch} from './customer-storage-test';
let active:CustomerProjectBinding|undefined;
let lifecycle:Promise<void>=Promise.resolve();
let generation=0;
let resetFailed=false;
function binding(){
  if(active)return active;
  const storage=window.localStorage;
  const url=`https://${DEV_PROJECT_REF}.supabase.co`;
  const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??'';
  const test=customerTestContext();if(!test)throw Error('explicit-test-arm-required');
  let created:CustomerProjectBinding;
  const session=createAnonymousSessionProvider({enabled:true,url,publishableKey,storage,request:journaledCustomerFetch,expectedOwner:()=>created?.owner()??null,signal:()=>created?.signal()});
  const port=prepareCustomerProjectApi({enabled:true,url,publishableKey,session,request:journaledCustomerFetch,signal:()=>created?.signal()});
  created=new CustomerProjectBinding({enabled:true,port,storage,localKey:STORAGE,uuid:()=>test.projectId,tabId:crypto.randomUUID()});active=created;return active;
}
export function notifyCustomerLocalSave(project:LocalProject){
  if(!CUSTOMER_CLOUD_SAVE_ENABLED)return; // No browser/credential/storage/Auth access while OFF.
  if(!customerTestContext())return;
  if(project.projectInfo.builderMode!=='consumer'){generation++;active?.stop();active=undefined;return;}
  const snapshot=JSON.parse(JSON.stringify(project)) as LocalProject;
  const epoch=generation;
  lifecycle=lifecycle.then(()=>{if(epoch===generation&&!resetFailed)return binding().save(snapshot);}).catch(()=>{/* State/pending local draft are preserved; no UI change or secret logging. */});
}
export function notifyCustomerLocalReset(){
  if(!CUSTOMER_CLOUD_SAVE_ENABLED)return;
  if(!customerTestContext())return;
  generation++;
  const previous=active;previous?.stop();active=undefined;
  const initialRaw=window.localStorage.getItem('bath-designer-customer-cloud-v1');
  lifecycle=lifecycle.then(async()=>{
    await previous?.retire();
    // Retain old metadata and backup; no remote DELETE. New identity uses the same verified Auth session.
    await rotateCustomerProject(window.localStorage,()=>crypto.randomUUID(),previous?.checkpoint()??initialRaw);
  }).catch(()=>{/* Reset metadata failure must not start cloud saving. */resetFailed=true;active?.stop();});
}
export async function inspectCustomerCloudConflict(){
  if(!CUSTOMER_CLOUD_SAVE_ENABLED)return null;await lifecycle;return active?.inspect()??null;
}
export async function reviewCustomerCloudServer(row:ProjectRow){
  if(!CUSTOMER_CLOUD_SAVE_ENABLED)throw Error('cloud-save-disabled');await lifecycle;
  if(!active)throw Error('no-active-project');await active.reviewServer(row);
}
if(typeof window!=='undefined'&&window.BathStorageTest){
 window.BathStorageTest.start=()=>notifyCustomerLocalSave(readProject());
 window.BathStorageTest.inspect=inspectCustomerCloudConflict;
 window.BathStorageTest.review=reviewCustomerCloudServer;
}
