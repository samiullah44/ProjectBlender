import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import handler from 'serve-handler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routes = [
  '/',
  '/features',
  '/features/gpu',
  '/features/network',
  '/features/analytics',
  '/how-it-works',
  '/faq',
  '/about',
  '/contact',
  '/participants/artists',
  '/participants/node-providers',
  '/participants/compute-clients',
  '/terms',
  '/privacy',
  '/risk',
  '/refund',
  '/aup'
];

async function prerender() {
  console.log('🚀 Starting Prerendering...');
  
  // 1. Start a simple server using serve-handler
  const server = http.createServer((request, response) => {
    return handler(request, response, {
      public: path.resolve(__dirname, '../dist'),
      rewrites: [{ source: '/**', destination: '/index.html' }]
    });
  });

  server.listen(5173, async () => {
    console.log('📡 Static server running on http://localhost:5173');

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    for (const route of routes) {
      const url = `http://localhost:5173${route}`;
      console.log(`📡 Prerendering: ${route}`);
      
      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        
        // Wait for #root to be populated
        await page.waitForSelector('#root nav, #root main', { timeout: 15000 });
        
        // Wait for potential splash screen to fade
        await new Promise(resolve => setTimeout(resolve, 2000));

        const content = await page.content();
        
        const outputPath = path.resolve(__dirname, '../dist', route === '/' ? 'index.html' : `${route.slice(1)}/index.html`);
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, content);
        
        console.log(`✅ Saved: ${outputPath} (${content.length} chars)`);
      } catch (err) {
        console.error(`❌ Failed to prerender ${route}:`, err.message);
      }
    }

    await browser.close();
    server.close();
    console.log('✨ Prerendering complete!');
    process.exit(0);
  });
}

prerender().catch(err => {
  console.error('❌ Prerendering fatal error:', err);
  process.exit(1);
});
