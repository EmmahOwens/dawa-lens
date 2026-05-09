
/**
 * Strips any leading non-numeric characters from a version string.
 * Handles tags like "v1.0.0", "v.1.0.0", "V.1.0.0", etc.
 */
const cleanVersion = (v: string): string => v.replace(/^[^\d]+/, '');

/**
 * Compares two semver strings (e.g. "1.0.11" vs "1.0.9").
 * Returns true if `remote` is strictly greater than `local`.
 */
export const isNewerVersion = (remote: string, local: string): boolean => {
  const cleanRemote = cleanVersion(remote);
  const cleanLocal = cleanVersion(local);

  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10));
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

export interface UpdateInfo {
  latestVersion: string;
  downloadUrl: string;
}

export const fetchLatestRelease = async (): Promise<UpdateInfo | null> => {
  try {
    const REPO = "EmmahOwens/dawa-lens";
    const GITHUB_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
    
    const response = await fetch(GITHUB_API_URL, { 
      cache: 'no-store',
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    const latestVersion = data.tag_name;
    
    if (!latestVersion) return null;

    const apkAsset = data.assets?.find((asset: any) => asset.name.toLowerCase().endsWith('.apk'));
    const downloadUrl = apkAsset ? apkAsset.browser_download_url : data.html_url;

    return {
      latestVersion: cleanVersion(latestVersion),
      downloadUrl
    };
  } catch (error) {
    console.error("Failed to fetch latest release:", error);
    return null;
  }
};
