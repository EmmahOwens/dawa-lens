const cleanVersion = (v) => v.replace(/^[^\d]+/, '');

const isNewerVersion = (remote, local) => {
  const cleanRemote = cleanVersion(remote);
  const cleanLocal = cleanVersion(local);

  const parse = (v) => v.split('.').map((n) => parseInt(n, 10));
  const r = parse(cleanRemote);
  const l = parse(cleanLocal);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (isNaN(rv) || isNaN(lv)) return false; // guard against malformed segments
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
};

console.log("v.1.0.21 vs 1.0.22 ->", isNewerVersion("v.1.0.21", "1.0.22"));
console.log("v1.0.23 vs 1.0.22 ->", isNewerVersion("v1.0.23", "1.0.22"));
console.log("1.0.22 vs 1.0.22 ->", isNewerVersion("1.0.22", "1.0.22"));
console.log(".1.0.21 vs 1.0.22 (old bug simulation) ->", isNewerVersion(".1.0.21", "1.0.22")); // Wait, my cleanVersion would clean .1.0.21 to 1.0.21
