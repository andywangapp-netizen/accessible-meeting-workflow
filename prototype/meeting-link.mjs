// Self-contained context links: fragments stay out of HTTP requests and referrers.
// Anyone holding the link can read its meeting; this is not an authentication token.
export function validateMeeting(value) {
  if (value?.version !== 1 || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 300 || typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 24000 || typeof value.simulated !== 'boolean') throw new Error('This meeting link is invalid. Open a new link from your recap email.');
  return {version:1,title:value.title,summary:value.summary,simulated:value.simulated};
}
export async function createMeetingLink(source, website) {
  const url = new URL(website);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Meeting website must use HTTP or HTTPS.');
  const meeting = validateMeeting({version:1,title:source.title,summary:source.summary,simulated:!!source.simulated});
  const stream = new Blob([JSON.stringify(meeting)]).stream().pipeThrough(new CompressionStream('deflate'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const encoded = btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  url.hash = `meeting=${encoded}`;
  return url.href;
}
export async function readMeetingLink(hash) {
  try {
    const encoded = new URLSearchParams(hash.replace(/^#/, '')).get('meeting');
    if (!encoded || encoded.length > 140000 || !/^[\w-]+$/.test(encoded)) throw new Error();
    const bytes = Uint8Array.from(atob(encoded.replaceAll('-','+').replaceAll('_','/')), c => c.charCodeAt(0));
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    const chunks = []; let length = 0;
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 100000) { await reader.cancel(); throw new Error(); }
      chunks.push(value);
    }
    const decoded = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { decoded.set(chunk,offset); offset += chunk.length; }
    return validateMeeting(JSON.parse(new TextDecoder().decode(decoded)));
  } catch { throw new Error('This meeting link is invalid. Open a new link from your recap email.'); }
}
