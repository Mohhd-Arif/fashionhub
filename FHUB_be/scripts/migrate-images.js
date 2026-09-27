const { connectDatabase, closeDatabase } = require('../config/database');
const { scanLegacyImages, migrateReference, cleanupMigratedLegacy } = require('../service/image-migration');

async function main() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : Infinity;
  if ((!Number.isInteger(limit) && limit !== Infinity) || limit < 1) throw new Error('--limit must be a positive integer.');
  const db = await connectDatabase();
  const references = await scanLegacyImages(db);
  const unique = new Set(references.map(item => item.image.fileId?.toString())).size;
  console.log(`Found ${references.length} legacy references across ${unique} GridFS images in ${db.databaseName}.`);
  if (!apply) {
    console.log('Dry run only. Add --apply to upload, verify and replace references.');
    return;
  }
  if (references.length && !process.env.IMAGEKIT_PRIVATE_KEY) throw new Error('IMAGEKIT_PRIVATE_KEY is missing. Migration did not start.');
  let changed = 0, failed = 0;
  for (const item of references.slice(0, limit)) {
    try {
      if (await migrateReference(db, item.collection, item.documentId, item)) changed++;
    } catch (error) {
      failed++;
      console.error(`${item.collection}/${item.documentId}/${item.path}: ${error.message}`);
    }
  }
  const cleaned = await cleanupMigratedLegacy(db);
  console.log(`Migrated ${changed} references; ${failed} failed; removed ${cleaned} fully migrated GridFS images. Rerun this command to resume remaining images.`);
  if (failed) process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => closeDatabase());
