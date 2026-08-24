const fs=require('fs'), vm=require('vm');
const html=fs.readFileSync(process.env.PPE_HTML || process.argv[2] || __dirname+'/../../plant_prime_editor_v1.0.html','utf8');
const blocks=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
const mk=()=>{const o={tagName:'DIV',id:'',className:'',innerHTML:'',outerHTML:'',textContent:'',value:'',
 checked:false,style:{setProperty(){},getPropertyValue:()=>''},dataset:{},files:[],options:[],selectedIndex:0,
 classList:{add(){},remove(){},toggle(){},contains:()=>false},children:[],childNodes:[],parentNode:null,
 appendChild(c){return c},removeChild(){},insertBefore(c){return c},replaceChild(){},cloneNode(){return mk()},
 setAttribute(){},getAttribute:()=>null,hasAttribute:()=>false,removeAttribute(){},
 addEventListener(){},removeEventListener(){},dispatchEvent(){return true},
 querySelector:()=>mk(),querySelectorAll:()=>[],getElementsByClassName:()=>[],getElementsByTagName:()=>[],
 closest:()=>null,matches:()=>false,click(){},focus(){},blur(){},select(){},remove(){},scrollIntoView(){},
 insertAdjacentHTML(){},getBoundingClientRect:()=>({top:0,left:0,right:0,bottom:0,width:0,height:0}),
 getContext:()=>({fillRect(){},clearRect(){},beginPath(){},stroke(){},fill(){},measureText:()=>({width:0})})};
 return o;};
const doc={createElement:mk,createElementNS:mk,createTextNode:()=>mk(),createDocumentFragment:mk,
 getElementById:()=>mk(),querySelector:()=>mk(),querySelectorAll:()=>[],getElementsByClassName:()=>[],
 getElementsByTagName:()=>[],addEventListener(){},removeEventListener(){},execCommand(){},
 body:mk(),head:mk(),documentElement:mk(),readyState:'complete',title:'',cookie:''};
const sb={console,document:doc,navigator:{userAgent:'Mozilla/5.0',clipboard:{writeText:()=>Promise.resolve()},language:'en'},
 location:{href:'https://akprimeedit.com/',search:'',hash:'',protocol:'https:',hostname:'akprimeedit.com',reload(){}},
 history:{pushState(){},replaceState(){}},screen:{width:1920,height:1080},
 localStorage:{getItem:()=>null,setItem(){},removeItem(){},clear(){}},
 sessionStorage:{getItem:()=>null,setItem(){},removeItem(){},clear(){}},
 setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,
 cancelAnimationFrame(){},queueMicrotask(f){try{f()}catch(e){}},
 fetch:()=>Promise.reject(new Error('offline')),XMLHttpRequest:class{open(){}send(){}setRequestHeader(){}},
 alert(){},confirm:()=>true,prompt:()=>null,print(){},open:()=>null,
 Math,JSON,Date,RegExp,Array,Object,String,Number,Boolean,Promise,Map,Set,WeakMap,WeakSet,Symbol,
 Intl,Error,TypeError,RangeError,SyntaxError,isNaN,isFinite,parseInt,parseFloat,BigInt,Proxy,Reflect,
 encodeURIComponent,decodeURIComponent,encodeURI,decodeURI,structuredClone,btoa:s=>Buffer.from(s).toString('base64'),
 atob:s=>Buffer.from(s,'base64').toString(),TextEncoder,TextDecoder,AbortController,
 Blob:class{constructor(){}},File:class{},FileReader:class{readAsText(){}},
 URL:{createObjectURL:()=>'',revokeObjectURL(){}},performance:{now:()=>Date.now()},
 CustomEvent:class{constructor(){}},Event:class{constructor(){}},MutationObserver:class{observe(){}disconnect(){}},
 IntersectionObserver:class{constructor(){}observe(){}unobserve(){}disconnect(){}takeRecords(){return[]}},
 ResizeObserver:class{observe(){}unobserve(){}disconnect(){}},matchMedia:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}),
 getComputedStyle:()=>({getPropertyValue:()=>''}),
 loadPyodide:()=>Promise.reject(new Error('pyodide offline'))};
sb.window=sb; sb.globalThis=sb; sb.self=sb; sb.top=sb; sb.parent=sb;
const ctx=vm.createContext(sb);
let hard=0;
blocks.forEach((m,i)=>{
  if(!/[A-Za-z]/.test(m[1]))return;
  const lineNo=html.slice(0,m.index).split('\n').length;
  try{ new vm.Script(m[1],{filename:`block${i}.js`}).runInContext(ctx,{timeout:20000}); console.log(`block ${i} (html line ${lineNo}): loaded clean`); }
  catch(e){ hard++;
    const st=(e.stack||'').split('\n').slice(0,4).join('\n      ');
    console.log(`block ${i} (html line ${lineNo}): THREW -> ${e.message}\n      ${st}`); }
});
console.log(hard?`\n${hard} block(s) threw at load`:'\nAll blocks executed without throwing.');
module.exports={ctx};
