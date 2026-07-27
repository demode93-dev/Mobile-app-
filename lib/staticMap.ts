// Builds a Google Static Maps snapshot of the traced polygon for embedding in
// the PDF quote.
//
// Why Static Maps instead of screenshotting the live map with html2canvas:
// the interactive Maps JS SDK renders satellite tiles that browsers refuse to
// read back into a <canvas> (a cross-origin "tainted canvas" error), so
// html2canvas silently returns a blank/failed capture even with
// useCORS: true. The Static Maps API sidesteps that entirely - it returns a
// plain PNG that already includes the traced polygon drawn server-side, so
// there's nothing to screenshot and nothing that can be tainted.

export interface LatLng {
  lat: number;
  lng: number;
}

export function buildStaticMapUrl(
  path: LatLng[],
  apiKey: string,
  size = '640x400'
): string {
  const points = path.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`);
  const closedPath = points.length > 0 ? [...points, points[0]] : [];

  const params = new URLSearchParams({
    size,
    maptype: 'satellite',
    key: apiKey,
  });

  const pathParam = `color:0x2563ebff|weight:3|fillcolor:0x3b82f640|${closedPath.join(
    '|'
  )}`;

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}&path=${encodeURIComponent(
    pathParam
  )}`;
}

/** Fetches an image URL and resolves it as a base64 data: URI. */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Static map request failed with status ${response.status}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
