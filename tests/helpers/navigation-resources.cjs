const assert=require('node:assert/strict');
/** A page transition can cancel prefetches and old-document assets. Every such
 * GET is re-requested and checked; real network/HTTP/MIME failures still fail. */
module.exports=function navigationResources(page,base,errors){
 const canceled=new Map();
 page.on('requestfailed',request=>{
  if(request.url().endsWith('/favicon.ico'))return;
  const error=request.failure()?.errorText;
  if(error==='net::ERR_ABORTED'&&request.method()==='GET'&&new URL(request.url()).origin===new URL(base).origin){canceled.set(request.url(),request);return;}
  errors.push(request.url()+': '+error);
 });
 return async()=>{
  for(const request of canceled.values()){
   const response=await page.context().request.get(request.url(),{headers:request.headers(),timeout:15000});
   assert.equal(response.status(),200,'canceled navigation asset remains available: '+request.url());
   assert.ok((await response.body()).length>0,'canceled asset has content');
   const pathname=new URL(request.url()).pathname,type=response.headers()['content-type']||'';
   if(/\.js$/.test(pathname))assert.match(type,/javascript/);
   if(/\.css$/.test(pathname))assert.match(type,/text\/css/);
   if(/\.(png|jpe?g|webp|svg)$/.test(pathname))assert.match(type,/^image\//);
   await response.dispose();
  }
  console.log('PASS revalidated '+canceled.size+' navigation-canceled GET resources; HTTP, MIME and content checked');
 };
};
