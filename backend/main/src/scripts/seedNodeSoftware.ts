/**
 * Seed Node Software Script (ZIP Version)
 *
 * Reads the built `.exe` from the dotnet publish output, wraps it in a `.zip`
 * using PowerShell's Compress-Archive, and uploads it to S3.
 *
 * Usage:
 *   npx tsx src/scripts/seedNodeSoftware.ts
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { S3Service } from '../services/S3Service';
import { env } from '../config/env';

// Candidate locations in order of preference
const EXE_CANDIDATES = [
    path.resolve(__dirname, '../../../../node/bin/Release/net10.0/win-x64/publish/BlendFarm.Node.exe'),
    path.resolve(__dirname, '../../../../node/bin/Release/win-x64/BlendFarm.Node.exe'),
    path.resolve(__dirname, '../../../../node/bin/Release/BlendFarm.Node.exe'),
];

function findExe(): string | null {
    for (const candidate of EXE_CANDIDATES) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

async function seedNodeSoftware(): Promise<void> {
    console.log('');
    console.log('  ┌──────────────────────────────────────────────┐');
    console.log('  │   BlendFarm – Node Software S3 Seed (ZIP)    │');
    console.log('  └──────────────────────────────────────────────┘');
    console.log('');

    const exePath = findExe();
    if (!exePath) {
        console.error('  ❌  EXE not found.');
        process.exit(1);
    }

    console.log(`  📂  Found EXE:  ${exePath}`);
    const zipPath = path.resolve(path.dirname(exePath), 'BlendFarmNode.zip');

    try {
        console.log('  🗜️   Compressing to ZIP...');
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

        const psCommand = `powershell -Command "Compress-Archive -Path '${exePath}' -DestinationPath '${zipPath}' -Force"`;
        execSync(psCommand, { stdio: 'inherit' });

        const stats = fs.statSync(zipPath);
        console.log(`  📦  ZIP Created: ${zipPath} (${formatBytes(stats.size)})`);

        const fileBuffer = fs.readFileSync(zipPath);
        const s3Service = new S3Service();

        console.log('  ⬆️   Uploading ZIP to S3...');
        const startTime = Date.now();
        const fileKey = await s3Service.uploadNodeSoftware(fileBuffer);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('');
        console.log(`  ✅  Upload successful! (${elapsed}s)`);
        console.log(`  🔗  URL: ${s3Service.getPublicUrl(fileKey)}`);
        console.log('');

        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
            console.log('  🧹  Temporary ZIP cleaned up.');
        }

    } catch (err: any) {
        console.error(`  ❌  Failed: ${err?.message}`);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

seedNodeSoftware();
