const vm=require('vm');
const {ctx}=require('./lib/load_tool.js');
const q=(expr)=>{ try{ return vm.runInContext(expr,ctx,{timeout:10000}); }catch(e){ return '<<ERR: '+e.message+'>>'; } };
module.exports={ctx,q};
if(require.main===module){
  console.log('VECTORS.length      ', q('typeof VECTORS!=="undefined" ? VECTORS.length : "undef"'));
  console.log('SCAFFOLD_SEQ        ', q('typeof SCAFFOLD_SEQ!=="undefined"? SCAFFOLD_SEQ : "undef"'));
  console.log('M3_SCAFFOLD         ', q('typeof M3_SCAFFOLD!=="undefined"? M3_SCAFFOLD : "undef"'));
  console.log('TEVO                ', q('typeof TEVO!=="undefined"? TEVO : "undef"'));
  console.log('TEVO_preQ1          ', q('typeof TEVO_preQ1!=="undefined"? TEVO_preQ1 : "undef"'));
  console.log('POLY_T_TERM         ', q('typeof POLY_T_TERM!=="undefined"? POLY_T_TERM : "undef"'));
  console.log('LINKER              ', q('typeof LINKER!=="undefined"? LINKER : "undef"'));
  console.log('_LINKER_POOL.length ', q('typeof _LINKER_POOL!=="undefined"? _LINKER_POOL.length : "undef"'));
  console.log('_M2_SCAF_3          ', q('typeof _M2_SCAF_3!=="undefined"? _M2_SCAF_3 : "undef"'));
  console.log('PE systems          ', q('typeof PE_SYSTEMS!=="undefined"? PE_SYSTEMS.map(p=>p.id||p.name).join(",") : "undef"'));
}
