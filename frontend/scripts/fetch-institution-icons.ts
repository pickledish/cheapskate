/**
 * Download favicons for known institutions into src/assets/institutions/.
 *
 * Prefers HTML-declared rel="icon" assets (SVG/PNG over leftover /favicon.ico).
 * Ignores apple-touch-icon and mask-icon.
 *
 * Usage:
 *   npm run fetch-institution-icons
 */
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTITUTION_DOMAINS } from '@/lib/institutions';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/institutions');

// IT IS A LIE but we're just GETing the home page of a couple dozen sites once in a blue moon,
// I hope the gods will forgive us here
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function extensionFor(contentType: string | null, url: string, bytes: Buffer): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return '.png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return '.gif';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return '.jpg';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') {
    return '.webp';
  }
  const start = bytes.subarray(0, 256).toString('utf8').trimStart();
  if (start.startsWith('<svg') || (start.startsWith('<?xml') && start.includes('<svg')))
    return '.svg';
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00)
    return '.ico';

  const type = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === 'image/png') return '.png';
  if (type === 'image/svg+xml') return '.svg';
  if (type === 'image/jpeg' || type === 'image/jpg') return '.jpg';
  if (type === 'image/webp') return '.webp';
  if (type === 'image/gif') return '.gif';
  if (type === 'image/x-icon' || type === 'image/vnd.microsoft.icon' || type === 'image/ico') {
    return '.ico';
  }
  const path = new URL(url).pathname.toLowerCase();
  const ext = path.match(/\.(png|svg|jpe?g|webp|gif|ico)$/)?.[1];
  if (ext === 'jpeg') return '.jpg';
  if (ext) return `.${ext}`;
  return '.ico';
}

async function fetchBuffer(
  url: string,
): Promise<{ bytes: Buffer; contentType: string | null; url: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,text/html;q=0.8,*/*;q=0.1' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type');
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 16) return null;
    return { bytes, contentType, url: res.url };
  } catch {
    return null;
  }
}

function isImage(contentType: string | null, bytes: Buffer): boolean {
  const type = (contentType ?? '').toLowerCase();
  if (type.startsWith('image/')) return true;
  // Some servers omit or lie about content-type; sniff common magic numbers.
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) return true;
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') {
    return true;
  }
  const start = bytes.subarray(0, 256).toString('utf8').trimStart();
  if (start.startsWith('<svg') || start.startsWith('<?xml')) return true;
  return false;
}

function relTokens(tag: string): string[] {
  const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
  return rel.toLowerCase().split(/[\s]+/).filter(Boolean);
}

function isDeclaredFavicon(tag: string): boolean {
  const tokens = relTokens(tag);
  if (
    tokens.some(
      (t) => t === 'apple-touch-icon' || t.startsWith('apple-touch-icon-') || t === 'mask-icon',
    )
  ) {
    return false;
  }
  return tokens.includes('icon');
}

function declaredSize(tag: string): number {
  const sizes = tag.match(/\bsizes\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
  let px = 0;
  for (const part of sizes.split(/\s+/)) {
    const m = part.match(/(\d+)\s*x\s*(\d+)/i);
    if (m) px = Math.max(px, Number(m[1]));
  }
  return px;
}

function iconScore(tag: string, href: string): number {
  const path = new URL(href).pathname.toLowerCase();
  const px = declaredSize(tag);
  if (path.endsWith('.svg')) return 20_000 + px;
  if (path.endsWith('.png') || path.endsWith('.webp')) return 10_000 + px;
  if (path.endsWith('.ico')) return px;
  return 1_000 + px;
}

function iconHrefsFromHtml(html: string, baseUrl: string): string[] {
  const candidates: { href: string; score: number }[] = [];
  const tags = html.match(/<link\s[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (!isDeclaredFavicon(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || href.startsWith('data:')) continue;
    try {
      const url = new URL(href, baseUrl).href;
      candidates.push({ href: url, score: iconScore(tag, url) });
    } catch {
      // ignore malformed href
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return [...new Set(candidates.map((c) => c.href))];
}

async function downloadIcon(domain: string): Promise<{ bytes: Buffer; ext: string } | null> {
  const origins = [`https://${domain}`];
  if (!domain.startsWith('www.')) origins.push(`https://www.${domain}`);

  let fallbackIco: { bytes: Buffer; ext: string } | null = null;

  for (const origin of origins) {
    const page = await fetchBuffer(origin);
    if (page) {
      const html = page.bytes.toString('utf8');
      for (const href of iconHrefsFromHtml(html, page.url)) {
        const icon = await fetchBuffer(href);
        if (icon && isImage(icon.contentType, icon.bytes)) {
          return { bytes: icon.bytes, ext: extensionFor(icon.contentType, icon.url, icon.bytes) };
        }
      }
    }

    const direct = await fetchBuffer(`${origin}/favicon.ico`);
    if (direct && isImage(direct.contentType, direct.bytes) && !fallbackIco) {
      fallbackIco = {
        bytes: direct.bytes,
        ext: extensionFor(direct.contentType, direct.url, direct.bytes),
      };
    }
  }
  return fallbackIco;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const name of await readdir(OUT_DIR)) {
    if (name.startsWith('.')) continue;
    await unlink(join(OUT_DIR, name));
  }

  const entries = Object.entries(INSTITUTION_DOMAINS);
  let ok = 0;
  const failed: string[] = [];

  for (const [key, domain] of entries) {
    process.stdout.write(`${key} (${domain})... `);
    const icon = await downloadIcon(domain);
    if (!icon) {
      console.log('FAILED');
      failed.push(key);
      continue;
    }
    const path = join(OUT_DIR, `${key}${icon.ext}`);
    await writeFile(path, icon.bytes);
    console.log(`${key}${icon.ext} (${icon.bytes.length} bytes)`);
    ok += 1;
  }

  console.log(`\nSaved ${ok}/${entries.length} icons to ${OUT_DIR}`);
  if (failed.length > 0) {
    console.error(`Missing: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

await main();
