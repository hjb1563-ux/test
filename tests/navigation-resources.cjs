const assert=require('node:assert/strict'),http=require('node:http');
const monitor=require('./helpers/navigation-resources.cjs');
(async()=>{
 const server=http.createServer((request,response)=>{
  if(request.url==='/missing.js'){response.writeHead(404);response.end('missing');return;}
  response.writeHead(200,{'content-type':request.url==='/wrong.js'?'text/html':'application/javascript'});response.end('/* verified */');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 function setup(path,method='GET',error='net::ERR_ABORTED'){
  const errors=[];let failed;
  const page={on:(event,fn)=>{if(event==='requestfailed')failed=fn;},context:()=>({request:{get:async(url,options)=>{
   const response=await fetch(url,{headers:options.headers});return {status:()=>response.status,headers:()=>Object.fromEntries(response.headers),body:async()=>Buffer.from(await response.arrayBuffer()),dispose:async()=>{}};
  }}})};
  const verify=monitor(page,base,errors);failed({url:()=>base+path,method:()=>method,failure:()=>({errorText:error}),headers:()=>({})});return {verify,errors};
 }
 try{
  await setup('/ok.js').verify();
  await assert.rejects(setup('/missing.js').verify(),/canceled navigation asset remains available/);
  await assert.rejects(setup('/wrong.js').verify(),/javascript/);
  const network=setup('/ok.js','GET','net::ERR_CONNECTION_REFUSED');assert.equal(network.errors.length,1);assert.match(network.errors[0],/ERR_CONNECTION_REFUSED/);
  const post=setup('/ok.js','POST');assert.equal(post.errors.length,1);assert.match(post.errors[0],/ERR_ABORTED/);
  console.log('PASS navigation cancellation controls: actual loopback GET, missing asset, wrong MIME, real network error and POST failure');
 }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
