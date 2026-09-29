// The homology ladder at a real benchmark locus, for the figure's panel B.
const {ctx}=require(require('path').resolve(__dirname,'..','tests','probe.js'));
const vm=require('vm'), fs=require('fs');
const run=(e,a)=>{ctx.__a=a;return vm.runInContext(e,ctx,{timeout:20000});};
function pc(l){const o=[];let c='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===','&&!q){o.push(c);c='';}else c+=ch;}o.push(c);return o;}
const csv=fs.readFileSync(require('path').resolve(__dirname,'..','data','benchmark_scored.csv'),'utf8').split('\n').filter(Boolean);
const H=pc(csv[0]),col=n=>H.indexOf(n);
const f=csv.slice(1).map(pc).find(x=>x[col('locus')]==='OsALS-T2 (Lin 2021)'&&x[col('edit_type')]==='SNP');
const g=f[col('genomic_seq')], st=f[col('spacer_strand')], nk=+f[col('nick_pos')];
const from=f[col('edit_from_top')]||f[col('edit_from')], to=f[col('edit_to_top')]||f[col('edit_to')];
const p=+f[col('edit_pos')]-1;
const ed=[{genomicPos:p,type:'SNP',ref:from,alt:to}];
const need=Math.abs(p-nk)+1;
const out=[];
for(let len=need; len<=need+14; len++){
  const r=run('genRT(__a.g,__a.n,__a.ed,__a.st,__a.l,__a.l,"","")',{g,n:nk,ed,st,l:len});
  if(!r.length){ out.push({len,hom:null,band:'none',warn:null}); continue; }
  const c=r[0], h=c.homologyBeyondEdit;
  const crit=c.warnings.find(w=>/CRITICAL: only \d+ nt of homology/.test(w));
  const soft=c.warnings.find(w=>/^Only \d+ nt of homology/.test(w));
  out.push({len,hom:h,band:crit?'critical':soft?'low':'ok',warn:(crit||soft||null)});
}
// what the DEFAULT search offers, for contrast
const wide=run('genRT(__a.g,__a.n,__a.ed,__a.st,10,34,"","")',{g,n:nk,ed,st});
const offered=wide.map(c=>({len:c.seq.length,hom:c.homologyBeyondEdit}));
const rec={locus:'OsALS-T2 (Lin 2021)',nick:nk,editPos:p,strand:st,minLen:need,ladder:out,
           default_offered:offered,
           default_min_homology:Math.min.apply(null,offered.map(o=>o.hom))};
fs.writeFileSync(require('path').join(__dirname,'homology_falsifiability.json'),JSON.stringify(rec,null,2));
console.log('minLen',need,'ladder rows',out.length);
out.forEach(o=>console.log('  len %d  hom %s  %s',o.len,String(o.hom),o.band));
console.log('default search offers lengths',offered.map(o=>o.len).join(','),'min homology',rec.default_min_homology);
