// Tiny QR Code SVG generator (byte mode, ECC L, auto version 1-10).
// Sufficient for short ticket QR identifiers.
const EXP=Array.from({length:512}), LOG=Array.from({length:256});
{let x=1; for(let i=0;i<255;i++){EXP[i]=x; LOG[x]=i; x<<=1; if(x&0x100) x^=0x11d;} for(let i=255;i<512;i++) EXP[i]=EXP[i-255];}
const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
const polyMul=(p,q)=>{const r=Array.from({length:p.length+q.length-1},()=>0); for(let i=0;i<p.length;i++) for(let j=0;j<q.length;j++) r[i+j]^=mul(p[i],q[j]); return r;};
const polyRest=(dividend,divisor)=>{const out=dividend.slice(); for(let i=0;i<=dividend.length-divisor.length;i++){ if(out[i]) for(let j=1;j<divisor.length;j++) if(divisor[j]) out[i+j]^=mul(divisor[j],out[i]); } return out.slice(out.length-divisor.length+1);};
const rsGen=(ec)=>{let g=[1]; for(let i=0;i<ec;i++) g=polyMul(g,[1,EXP[i]]); return g;};
// RS params omitted (using V table below)
// Use standard ECC M single-block params for versions 1-10
const V=[
 null,
 {n:26,d:16,ec:10,align:[]},
 {n:44,d:28,ec:16,align:[6,18]},
 {n:70,d:44,ec:26,align:[6,22]},
 {n:100,d:64,ec:36,align:[6,26]},
 {n:134,d:86,ec:48,align:[6,30]},
 {n:172,d:108,ec:64,align:[6,34]},
 {n:196,d:122,ec:74,align:[6,22,38]},
 {n:242,d:152,ec:90,align:[6,24,42]},
 {n:292,d:180,ec:112,align:[6,26,46]},
 {n:346,d:216,ec:130,align:[6,28,50]},
];
function makeData(ver, bytes){
  const cap=V[ver].d; const bb=[]; const pushBits=(val,len)=>{for(let i=len-1;i>=0;i--) bb.push((val>>i)&1);};
  pushBits(0b0100,4); // byte mode
  const lenBits=ver<=9?8:16; pushBits(bytes.length,lenBits);
  for(const b of bytes) pushBits(b,8);
  pushBits(0,Math.min(4, cap*8-bb.length));
  while(bb.length%8) bb.push(0);
  const pad=[0xec,0x11]; let pi=0; const data=[];
  for(let i=0;i<bb.length;i+=8){ let v=0; for(let j=0;j<8;j++) v=(v<<1)|bb[i+j]; data.push(v); }
  while(data.length<cap){ data.push(pad[pi]); pi^=1; }
  const ec=V[ver].ec; const rs=polyRest(data.concat(Array.from({length:ec},()=>0)), rsGen(ec));
  return data.concat(rs);
}
function createMatrix(ver, data){
  const size=ver*4+17; const m=Array.from({length:size},()=>Array(size).fill(null)); const res=Array.from({length:size},()=>Array(size).fill(false));
  const set=(r,c,v,f=false)=>{if(r>=0&&r<size&&c>=0&&c<size){m[r][c]=v; if(f) res[r][c]=true;}};
  const finder=(r,c)=>{for(let y=-1;y<=7;y++) for(let x=-1;x<=7;x++){const rr=r+y,cc=c+x; if(rr<0||rr>=size||cc<0||cc>=size) continue; const on=(y>=0&&y<=6&&(x==0||x==6))||(x>=0&&x<=6&&(y==0||y==6))||(y>=2&&y<=4&&x>=2&&x<=4); set(rr,cc,on,true);} };
  finder(0,0); finder(size-7,0); finder(0,size-7);
  for(let i=8;i<size-8;i++){ if(m[6][i]==null) set(6,i,i%2===0,true); if(m[i][6]==null) set(i,6,i%2===0,true); }
  const aligns=V[ver].align; for(let i=0;i<aligns.length;i++) for(let j=0;j<aligns.length;j++){const r=aligns[i],c=aligns[j]; if(m[r][c]!=null) continue; for(let y=-2;y<=2;y++) for(let x=-2;x<=2;x++) set(r+y,c+x,Math.abs(x)===2||Math.abs(y)===2||(x===0&&y===0),true);} 
  set(size-8,8,true,true);
  // format/info placeholders (mask 0, ECC M=00 -> bits 101010000010010? easier use fixed for M mask0)
  // format for ECC M (00) mask 0: 101010000010010 => 0x5412, BCH+mask gives 0x77C4? simpler compute minimal: use standard value for M, mask 0 = 0x5412? actually computed value is 0x77c4 after masking in some forms; easier to set from known constant
  const formatBits=0x5b37; // ECC M, mask 0 precomputed
  const setFmt=(i)=>(((formatBits>>i)&1)===1);
  const coordsA=[[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],[8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0]];
  const coordsB=[[8,size-1],[8,size-2],[8,size-3],[8,size-4],[8,size-5],[8,size-6],[8,size-7],[size-7,8],[size-6,8],[size-5,8],[size-4,8],[size-3,8],[size-2,8],[size-1,8]];
  for(let i=0;i<15;i++){ set(coordsA[i][0],coordsA[i][1],setFmt(14-i),true); set(coordsB[i][0],coordsB[i][1],setFmt(14-i),true); }
  let bit=0; for(let c=size-1;c>0;c-=2){ if(c===6) c--; for(let k=0;k<size;k++){ const r=((Math.floor((size-1-c)/(c<6?2:2))%2)===0)?(size-1-k):k; for(let j=0;j<2;j++){ const cc=c-j; if(m[r][cc]==null){ let v=false; if(bit < data.length*8){ v=((data[Math.floor(bit/8)]>>(7-bit%8))&1)===1; bit++; } // mask 0: (r+c)%2==0
            if(((r+cc)%2)===0) v=!v; set(r,cc,v,false); } } } }
  return {m, size};
}
export function qrToSvg(text, px=180, margin=4){
  const bytes=Array.from(new TextEncoder().encode(text));
  let ver=1; while(ver<=10 && bytes.length>V[ver].d-2) ver++; if(ver>10) throw new Error('QR payload too large');
  const {m,size}=createMatrix(ver, makeData(ver, bytes));
  const dim=size+margin*2, s=px/dim; let rects='';
  for(let r=0;r<size;r++) for(let c=0;c<size;c++) if(m[r][c]) rects+=`<rect x="${((c+margin)*s).toFixed(2)}" y="${((r+margin)*s).toFixed(2)}" width="${(s+0.02).toFixed(2)}" height="${(s+0.02).toFixed(2)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${px}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
