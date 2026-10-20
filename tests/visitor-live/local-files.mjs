import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const quote=s=>"'"+s.replaceAll("'","''")+"'";
function ps(script,input) {
  try{return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']}).trim()}catch{throw new Error('local-protection-failed')}
}
export function assertProtected(file) {
  const stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw new Error('reparse-path-not-allowed');
  if(process.platform==='win32'){
    const result=ps(`$ErrorActionPreference='Stop'; $a=Get-Acl -LiteralPath ${quote(file)}; $me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $ok=$a.AreAccessRulesProtected; foreach($r in $a.Access){$sid=$r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value; if($r.IsInherited -or $sid -notin @($me,'S-1-5-18') -or $r.AccessControlType -ne 'Allow'){$ok=$false}}; if($a.Access.Count -eq 0){$ok=$false}; Write-Output $ok`);
    if(result!=='True')throw new Error('unsafe-local-acl');
  }else if((stat.mode&0o077)!==0)throw new Error('unsafe-local-mode');
}
function restrict(file,directory=false) {
  if(process.platform==='win32')ps(`$ErrorActionPreference='Stop'; $me=[Security.Principal.WindowsIdentity]::GetCurrent().Name; & icacls.exe ${quote(file)} /inheritance:r /grant:r ( $me+${quote(directory?':(OI)(CI)F':':F')} ) 'SYSTEM:${directory?'(OI)(CI)':''}F' | Out-Null; if($LASTEXITCODE -ne 0){throw 'acl'};`);
  else fs.chmodSync(file,directory?0o700:0o600);
  assertProtected(file);
}
export function artifactRoot(repo) {
  const parent=path.join(repo,'tests','artifacts');fs.mkdirSync(parent,{recursive:true});
  // Reject junction/symlink escapes in all artifact ancestors inside the repository.
  for(const p of [path.join(repo,'tests'),parent])if(fs.lstatSync(p).isSymbolicLink())throw new Error('reparse-path-not-allowed');
  const root=path.join(parent,'visitor-live');
  if(!fs.existsSync(root)){fs.mkdirSync(root,{mode:0o700});restrict(root,true)}
  assertProtected(root);return root;
}
export function inside(root,file) {
  const resolved=path.resolve(file);if(path.dirname(resolved)!==root)throw new Error('artifact-path-not-allowed');return resolved;
}
export function atomicWrite(file,value) {
  if(fs.existsSync(file))assertProtected(file);
  const tmp=file+'.'+randomBytes(8).toString('hex')+'.tmp';let fd;
  try{
    fd=fs.openSync(tmp,'wx',0o600);fs.closeSync(fd);fd=undefined;restrict(tmp);
    fd=fs.openSync(tmp,'r+');fs.writeFileSync(fd,value,{encoding:'utf8'});fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
    fs.renameSync(tmp,file);assertProtected(file);
  }finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
}
export function acquireLock(root) {
  const file=path.join(root,'active.lock');let fd;
  try{fd=fs.openSync(file,'wx',0o600);fs.closeSync(fd);fd=undefined;restrict(file);fs.writeFileSync(file,JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}));}
  catch{if(fd!==undefined)fs.closeSync(fd);throw new Error('lock-held-or-unavailable')}
  return()=>{fs.unlinkSync(file)};
}
export function encryptRecovery(value) {
  if(process.platform!=='win32')throw new Error('windows-dpapi-required');
  return ps(`$ErrorActionPreference='Stop'; $raw=[Console]::In.ReadToEnd(); $s=ConvertTo-SecureString -String $raw -AsPlainText -Force; ConvertFrom-SecureString -SecureString $s`,JSON.stringify(value));
}

export function assertNoPreviousRuns(root) {
  if(fs.readdirSync(root).some(n=>n.includes('.journal.json')||n.includes('.recovery.dpapi')||n.endsWith('.tmp')))throw new Error('previous-run-requires-review');
}
