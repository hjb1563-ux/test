// Test-only serialized lock port. Production never imports this fallback.
exports.mockLocks=()=>{
 const tails=new Map();return {run(name,work){const before=tails.get(name)||Promise.resolve();const next=before.then(()=>work(new AbortController().signal));tails.set(name,next.catch(()=>{}));return next;}};
};
