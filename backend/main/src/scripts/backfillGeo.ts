/**
 * Geo Backfill Script
 *
 * Re-resolves geo data for all AnalyticsUser records that have a stored
 * ipAddress but are missing geo.country (null, undefined, or "Development Env").
 *
 * Usage:
 *   npx tsx src/scripts/backfillGeo.ts
 *
 * Options (env vars):
 *   DRY_RUN=true   — print what would be updated without writing to DB
 *   BATCH_SIZE=50  — how many users to process per batch (default: 30)
 *   DELAY_MS=1500  — ms delay between batches to respect ip-api.com rate limit
 *                    (free tier: 45 req/min = ~1333ms between requests)
 */

import mongoose from 'mongoose';
import { env } from '../config/env';
import { AnalyticsUser } from '../models/Analytics';
import { resolveGeoFromIp } from '../utils/geoIp';

const DRY_RUN    = process.env.DRY_RUN === 'true';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '30', 10);
const DELAY_MS   = parseInt(process.env.DELAY_MS   || '1500', 10);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function backfillGeo() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(env.mongodbUri);
  console.log('✅ Connected\n');

  if (DRY_RUN) console.log('⚠️  DRY RUN — no writes will be made\n');

  // Find users that have an IP but missing/bad geo
  const query = {
    ipAddress: { $exists: true, $ne: null, $ne: '' },
    $or: [
      { 'geo.country': { $exists: false } },
      { 'geo.country': null },
      { 'geo.country': 'Development Env' },
      { 'geo.country': 'DEV' },
    ],
  };

  const total = await AnalyticsUser.countDocuments(query);
  console.log(`📊 Found ${total} users needing geo backfill\n`);

  if (total === 0) {
    console.log('✅ Nothing to backfill.');
    await mongoose.disconnect();
    process.exit(0);
  }

  let processed = 0;
  let updated   = 0;
  let skipped   = 0;
  let failed    = 0;

  // Process in batches to avoid loading all docs into memory
  let lastId: mongoose.Types.ObjectId | null = null;

  while (processed < total) {
    const batchQuery: any = { ...query };
    if (lastId) batchQuery._id = { $gt: lastId };

    const batch = await AnalyticsUser.find(batchQuery)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .select('_id userId ipAddress geo')
      .lean();

    if (batch.length === 0) break;

    for (const user of batch) {
      processed++;
      const ip = user.ipAddress as string;

      process.stdout.write(`[${processed}/${total}] userId=${user.userId} ip=${ip} → `);

      try {
        const geo = await resolveGeoFromIp(ip);

        if (!geo) {
          console.log('⏭  skipped (private/unresolvable IP)');
          skipped++;
        } else {
          console.log(`✅ ${geo.city || '?'}, ${geo.country} (${geo.countryCode})`);
          if (!DRY_RUN) {
            await AnalyticsUser.updateOne(
              { _id: user._id },
              { $set: { geo } }
            );
          }
          updated++;
        }
      } catch (err: any) {
        console.log(`❌ error: ${err.message}`);
        failed++;
      }

      // Respect ip-api.com free tier: 45 req/min
      await sleep(DELAY_MS);
    }

    lastId = batch[batch.length - 1]._id as mongoose.Types.ObjectId;

    console.log(`\n--- Batch done. Progress: ${processed}/${total} ---\n`);
  }

  console.log('\n════════════════════════════════');
  console.log(`✅ Backfill complete`);
  console.log(`   Total processed : ${processed}`);
  console.log(`   Updated         : ${updated}`);
  console.log(`   Skipped (no geo): ${skipped}`);
  console.log(`   Failed          : ${failed}`);
  if (DRY_RUN) console.log('   (DRY RUN — no writes made)');
  console.log('════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

backfillGeo().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
