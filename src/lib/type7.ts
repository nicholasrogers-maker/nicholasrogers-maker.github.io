// Cisco "type 7" password encoding. It's a fixed XOR table, so it's trivially reversible:
// obfuscation, not encryption. Used by the site CTF (and the `decrypt type7` CLI command).
const XLAT = 'dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87';

export function type7Encode(plain: string, seed = 7): string {
  let out = String(seed).padStart(2, '0');
  for (let i = 0; i < plain.length; i++) {
    const x = plain.charCodeAt(i) ^ XLAT.charCodeAt((seed + i) % XLAT.length);
    out += x.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

export function type7Decode(hash: string): string | null {
  if (!/^\d{2}(?:[0-9a-f]{2})+$/i.test(hash)) return null;
  const seed = parseInt(hash.slice(0, 2), 10);
  if (seed > 15) return null;
  let out = '';
  for (let i = 2, j = 0; i < hash.length; i += 2, j++) {
    out += String.fromCharCode(parseInt(hash.slice(i, i + 2), 16) ^ XLAT.charCodeAt((seed + j) % XLAT.length));
  }
  return out;
}
