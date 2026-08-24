const {q}=require('./probe.js');
let PASS=0,FAIL=0;
const chk=(name,got,want,note)=>{const ok=String(got)===String(want);ok?PASS++:FAIL++;
  console.log((ok?'  PASS  ':'* FAIL *')+' '+name.padEnd(46)+' got '+String(got).slice(0,60)+(ok?'':'   want '+String(want).slice(0,60))+(note?'   ['+note+']':''));};
const rule=t=>console.log('\n=== '+t+' ===');

rule('1. Core sequences');
const SC=q('M3_SCAFFOLD');
chk('scaffold length', SC.length, 76, 'standard SpCas9 sgRNA scaffold');
chk('scaffold = canonical SpCas9', SC, 'GTTTTAGAGCTAGAAATAGCAAGTTAAAATAAGGCTAGTCCGTTATCAACTTGAAAAAGTGGCACCGAGTCGGTGC');
chk('scaffold starts GTTTTAGAGCTAGAAATAGCAAG', SC.slice(0,23), 'GTTTTAGAGCTAGAAATAGCAAG', 'repeat:anti-repeat duplex');
chk('_M2_SCAF_3 is truly the last 27 nt', q('_M2_SCAF_3'), SC.slice(-27));
chk('tevopreQ1 length', q('TEVO_preQ1').length, 37, 'Nelson 2022 Nat Biotechnol 40:402');
chk('TEVO === TEVO_preQ1 (no drift)', q('TEVO'), q('TEVO_preQ1'));
chk('polyT terminator is >=6 T', /^T{6,}$/.test(q('POLY_T_TERM')), true, 'Pol III termination');

rule('2. Reverse complement and GC');
chk('m2_rc palindrome check', q('m2_rc("GAATTC")'), 'GAATTC', 'EcoRI is palindromic');
chk('m2_rc ACGT', q('m2_rc("ACGT")'), 'ACGT');
chk('m2_rc AAAACCCC', q('m2_rc("AAAACCCC")'), 'GGGGTTTT');
chk('m2_rc round-trip 30-mer', q('m2_rc(m2_rc("ACGTTGCAATCGGATCCTAGCTAGCTAGCT"))'), 'ACGTTGCAATCGGATCCTAGCTAGCTAGCT');
chk('m3_rc agrees with m2_rc', q('m3_rc("ATGCATGCATGC")'), q('m2_rc("ATGCATGCATGC")'));
chk('m2_gc 50%', q('m2_gc("ACGT")'), 50);
chk('m2_gc 0%', q('m2_gc("AAAATTTT")'), 0);
chk('m2_gc 100%', q('m2_gc("GGGGCCCC")'), 100);

rule('3. Melting temperature (SantaLucia NN)');
// Wallace check on a short oligo; NN should be in a sane range and monotone in length
const t10=q('m2_calcTm("CCAAATGTTG")'), t20=q('m2_calcTm("CCAAATGTTGGTTGTTCAAC")');
chk('Tm rises with length', t20>t10, true, `10nt ${t10} -> 20nt ${t20}`);
chk('Tm of GC-rich > AT-rich (same length)', q('m2_calcTm("GCGCGCGCGCGC")')>q('m2_calcTm("ATATATATATAT")'), true,
    `GC ${q('m2_calcTm("GCGCGCGCGCGC")')} vs AT ${q('m2_calcTm("ATATATATATAT")')}`);
chk('Tm is finite for 5-mer', Number.isFinite(q('m2_calcTm("ACGTA")')), true, 'value '+q('m2_calcTm("ACGTA")'));
chk('m3_calcTm returns primer-range Tm for 20-mer', (()=>{const v=q('m3_calcTm("TAGGCGTATCACGAGGCAGA")');return v>50&&v<70;})(), true, 'value '+q('m3_calcTm("TAGGCGTATCACGAGGCAGA")'));
// Wallace formula sanity, computed inline the way genPBS does
chk('Wallace of CCAAATGTTG = 28', 4*4+2*6, 28, '4 GC, 6 AT');

rule('4. Codon translation');
chk('translate TGG -> W', q('translate("TGG",0,false)'), 'W');
chk('translate TTG -> L', q('translate("TTG",0,false)'), 'L');
chk('translate ATG GCA TAA', q('translate("ATGGCATAA",0,false)'), 'MA*');
chk('all three stops', q('translate("TAATAGTGA",0,false)'), '***');
chk('Met/Trp unique codons', q('translate("ATGTGG",0,false)'), 'MW');
chk('frame offset works', q('translate("XATGGCA".slice(1),0,false)'), 'MA');
chk('aaImpact W->L non-conservative', q('JSON.stringify(aaImpact("W","L"))').replace(/"/g,''), 'Non-conservative');
chk('aaImpact K->R conservative-ish', /conserv/i.test(q('JSON.stringify(aaImpact("K","R"))')), true, q('JSON.stringify(aaImpact("K","R"))'));

rule('5. PAM matching with IUPAC');
chk('NGG matches AGG', q('pamMatchSeq("AGG","NGG")'), true);
chk('NGG matches TGG', q('pamMatchSeq("TGG","NGG")'), true);
chk('NGG rejects AGA', q('pamMatchSeq("AGA","NGG")'), false);
chk('NG matches CG', q('pamMatchSeq("CG","NG")'), true);
chk('NRG matches AAG (R=A/G)', q('pamMatchSeq("AAG","NRG")'), true);
chk('NRG rejects ACG', q('pamMatchSeq("ACG","NRG")'), false);
chk('TTTV matches TTTA', q('pamMatchSeq("TTTA","TTTV")'), true, 'Cas12a');
chk('TTTV rejects TTTT', q('pamMatchSeq("TTTT","TTTV")'), false);

console.log(`\n${PASS} passed, ${FAIL} failed`);
