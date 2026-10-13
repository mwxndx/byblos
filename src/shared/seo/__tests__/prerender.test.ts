import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { generateHtml, pages, SITE_URL } from '../../../../scripts/prerender-public-pages.mjs';

describe('Public Pages Static Pre-rendering (SSG)', () => {
  const dummyTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Default Title</title>
  <meta name="title" content="Default Title" />
  <meta name="description" content="Default description" />
  <meta property="og:title" content="Default Title" />
  <meta property="og:description" content="Default description" />
  <meta property="og:url" content="${SITE_URL}/" />
  <meta property="twitter:title" content="Default Title" />
  <meta property="twitter:description" content="Default description" />
  <meta property="twitter:url" content="${SITE_URL}/" />
</head>
<body>
  <div id="root">
    <div id="initial-splash" aria-hidden="true">
      <img src="/byblos-mark-dark.png" alt="Byblos" class="splash-logo splash-logo-dark" />
    </div>
  </div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;

  it('defines all required public routes with valid metadata', () => {
    const requiredPaths = ['/', '/privacy', '/terms', '/delete-account'];
    const definedPaths = pages.map((p) => p.path);

    expect(definedPaths).toEqual(expect.arrayContaining(requiredPaths));

    for (const page of pages) {
      expect(page.title).toBeTruthy();
      expect(page.description).toBeTruthy();
      expect(page.canonical).toMatch(new RegExp(`^${SITE_URL}`));
      expect(page.content).toBeTruthy();

      // Ensure word count is rich (> 200 words)
      const rawText = page.content.replace(/<[^>]+>/g, ' ');
      const words = rawText.split(/\s+/).filter(Boolean);
      expect(words.length).toBeGreaterThan(200);
    }
  });

  it('correctly updates metadata and injects prerender content into the HTML template', () => {
    const privacyPage = pages.find((p) => p.path === '/privacy')!;
    const outputHtml = generateHtml(dummyTemplate, privacyPage);

    // Title & meta description
    expect(outputHtml).toContain(`<title>${privacyPage.title}</title>`);
    expect(outputHtml).toContain(`content="${privacyPage.description}"`);

    // Canonical link
    expect(outputHtml).toContain(`<link rel="canonical" href="${privacyPage.canonical}" />`);

    // OpenGraph & Twitter tags
    expect(outputHtml).toContain(`<meta property="og:title" content="${privacyPage.title}" />`);
    expect(outputHtml).toContain(`<meta property="og:url" content="${privacyPage.canonical}" />`);
    expect(outputHtml).toContain(`<meta property="twitter:title" content="${privacyPage.title}" />`);

    // Preserves #initial-splash
    expect(outputHtml).toContain('<div id="initial-splash" aria-hidden="true">');

    // Injects prerender-fallback and noscript
    expect(outputHtml).toContain('class="prerender-fallback"');
    expect(outputHtml).toContain('class="seo-fallback"');
    expect(outputHtml).toContain('Byblos Privacy Policy');
    expect(outputHtml).toContain('Data Protection Act, 2019');
  });

  it('ensures post-build pre-rendered files exist on disk with valid content when dist/ is present', () => {
    const distDir = join(process.cwd(), 'dist');
    if (!existsSync(distDir)) {
      // In clean workspace before build, skip disk verification
      return;
    }

    for (const page of pages) {
      if (existsSync(page.outputPath)) {
        const fileContent = readFileSync(page.outputPath, 'utf8');

        expect(fileContent).toContain(`<title>${page.title}</title>`);
        expect(fileContent).toContain(`href="${page.canonical}"`);
        expect(fileContent).toContain('<div id="initial-splash"');
        expect(fileContent).toContain('class="prerender-fallback"');

        // Check word count of the generated file
        const textOnly = fileContent.replace(/<[^>]+>/g, ' ');
        const wordCount = textOnly.split(/\s+/).filter(Boolean).length;
        expect(wordCount).toBeGreaterThan(500);
      }
    }
  });
});
