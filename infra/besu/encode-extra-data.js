'use strict';

/**
 * Encodes QBFT genesis extraData correctly.
 *
 * QBFT extraData RLP format:
 * RLP([
 *   vanity (32 bytes),
 *   validators (list of 20-byte addresses),
 *   votes (empty list),
 *   round (integer 0),
 *   seals (empty list)
 * ])
 */

const fs   = require('fs');
const path = require('path');

// Read the 4 validator addresses from key files
const BASE = path.resolve(__dirname);

function readAddress(dir) {
  const keyFile = path.join(BASE, dir, 'key');
  if (!fs.existsSync(keyFile)) {
    throw new Error(`Key file not found: ${keyFile}. Run generate-keys.js first.`);
  }
  const privHex = fs.readFileSync(keyFile, 'utf8').trim();
  return deriveAddress(Buffer.from(privHex, 'hex'));
}

// ── Minimal secp256k1 address derivation ─────────────────────────────────────
function deriveAddress(privKeyBuf) {
  try {
    const ecdh = require('crypto').createECDH('secp256k1');
    ecdh.setPrivateKey(privKeyBuf);
    const pub = ecdh.getPublicKey(); // 65 bytes uncompressed
    const pubBody = pub.slice(1);    // 64 bytes
    return '0x' + keccak256(pubBody).slice(-20).toString('hex');
  } catch (e) {
    throw new Error('secp256k1 not available: ' + e.message);
  }
}

// ── Keccak-256 (pure JS) ─────────────────────────────────────────────────────
function keccak256(data) {
  const msgBuf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const RC = [
    [0x00000001,0x00000000],[0x00008082,0x00000000],[0x0000808a,0x80000000],
    [0x80008000,0x80000000],[0x0000808b,0x00000000],[0x80000001,0x00000000],
    [0x80008081,0x80000000],[0x00008009,0x80000000],[0x0000008a,0x00000000],
    [0x00000088,0x00000000],[0x80008009,0x00000000],[0x8000000a,0x00000000],
    [0x8000808b,0x00000000],[0x0000008b,0x80000000],[0x00008089,0x80000000],
    [0x00008003,0x80000000],[0x00008002,0x80000000],[0x00000080,0x80000000],
    [0x0000800a,0x00000000],[0x8000000a,0x80000000],[0x80008081,0x80000000],
    [0x00008080,0x80000000],[0x80000001,0x00000000],[0x80008008,0x80000000],
  ];
  const ROT = [[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];
  function rol64(lo, hi, n) {
    if (n===0) return [lo,hi];
    if (n<32) return [(lo<<n)|(hi>>>(32-n)),(hi<<n)|(lo>>>(32-n))];
    if (n===32) return [hi,lo];
    n-=32; return [(hi<<n)|(lo>>>(32-n)),(lo<<n)|(hi>>>(32-n))];
  }
  function kf(s) {
    for (let r=0;r<24;r++) {
      const C=Array.from({length:5},(_,x)=>[s[x][0]^s[x+5][0]^s[x+10][0]^s[x+15][0]^s[x+20][0],s[x][1]^s[x+5][1]^s[x+10][1]^s[x+15][1]^s[x+20][1]]);
      const D=Array.from({length:5},(_,x)=>{const r1=rol64(C[(x+1)%5][0],C[(x+1)%5][1],1);return[C[(x+4)%5][0]^r1[0],C[(x+4)%5][1]^r1[1]];});
      for(let x=0;x<5;x++) for(let y=0;y<5;y++){s[x+y*5][0]^=D[x][0];s[x+y*5][1]^=D[x][1];}
      const B=new Array(25).fill(null).map(()=>[0,0]);
      for(let x=0;x<5;x++) for(let y=0;y<5;y++){const rot=ROT[x][y];const[lo,hi]=rol64(s[x+y*5][0],s[x+y*5][1],rot);B[y+((2*x+3*y)%5)*5]=[lo,hi];}
      for(let x=0;x<5;x++) for(let y=0;y<5;y++){const i=x+y*5;s[i][0]=B[i][0]^(~B[((x+1)%5)+y*5][0]&B[((x+2)%5)+y*5][0]);s[i][1]=B[i][1]^(~B[((x+1)%5)+y*5][1]&B[((x+2)%5)+y*5][1]);}
      s[0][0]^=RC[r][0];s[0][1]^=RC[r][1];
    }
  }
  const rate=136,msgLen=msgBuf.length,padLen=rate-(msgLen%rate)<8?rate*2-(msgLen%rate):rate-(msgLen%rate);
  const padded=Buffer.alloc(msgLen+padLen,0);
  msgBuf.copy(padded);padded[msgLen]=0x01;padded[padded.length-1]|=0x80;
  const state=new Array(25).fill(null).map(()=>[0,0]);
  for(let i=0;i<padded.length;i+=rate){
    for(let j=0;j<rate/8;j++){const off=i+j*8;state[j][0]^=padded.readUInt32LE(off);state[j][1]^=padded.readUInt32LE(off+4);}
    kf(state);
  }
  const out=Buffer.alloc(32);
  for(let i=0;i<4;i++){out.writeUInt32LE(state[i][0],i*8);out.writeUInt32LE(state[i][1],i*8+4);}
  return out;
}

// ── RLP encoding ─────────────────────────────────────────────────────────────
function rlpEncodeLength(len, offset) {
  if (len < 56) return Buffer.from([offset + len]);
  const hex = len.toString(16).padStart(len.toString(16).length % 2 === 0 ? 0 : 1, '0');
  const lenBuf = Buffer.from(hex.padStart(Math.ceil(hex.length / 2) * 2, '0'), 'hex');
  return Buffer.concat([Buffer.from([offset + 55 + lenBuf.length]), lenBuf]);
}

function rlpEncodeItem(buf) {
  if (buf.length === 1 && buf[0] < 0x80) return buf;
  return Buffer.concat([rlpEncodeLength(buf.length, 0x80), buf]);
}

function rlpEncodeList(items) {
  const encoded = Buffer.concat(items.map(rlpEncodeItem));
  return Buffer.concat([rlpEncodeLength(encoded.length, 0xc0), encoded]);
}

// ── Main ─────────────────────────────────────────────────────────────────────
const validators = ['validator1','validator2','validator3','validator4'].map(d => {
  const addr = readAddress(d);
  console.log(`  ${d}: ${addr}`);
  return Buffer.from(addr.slice(2), 'hex'); // 20 bytes
});

const vanity     = Buffer.alloc(32, 0);
const votes      = rlpEncodeList([]);     // empty list
const round      = Buffer.from([0x80]);   // integer 0 encoded as RLP empty string
const seals      = rlpEncodeList([]);     // empty list

// Build validator list items
const validatorListItems = validators.map(v => v); // each is 20 bytes

// RLP encode the full extraData
// Structure: [vanity(32), [validators], votes, round, seals]
const vanityRlp    = rlpEncodeItem(vanity);
const validListRlp = rlpEncodeList(validatorListItems);
const votesRlp     = votes;
const roundRlp     = round;
const sealsRlp     = seals;

const inner = Buffer.concat([vanityRlp, validListRlp, votesRlp, roundRlp, sealsRlp]);
const extraData = '0x' + inner.toString('hex');

console.log('\nGenerated extraData:');
console.log(extraData);

// Update genesis.json
const genesisPath = path.join(BASE, 'genesis.json');
const genesis = JSON.parse(fs.readFileSync(genesisPath, 'utf8'));
genesis.extraData = extraData;
fs.writeFileSync(genesisPath, JSON.stringify(genesis, null, 2));
console.log('\ngenesis.json updated with correct extraData');
