/**
 * CampusFlow — JavaScript-First Architecture Safeguard
 *
 * Verifies that the repository contains only native JavaScript / JSX files
 * and detects prohibited TypeScript source files (.ts, .tsx, .mts, .cts)
 * or TypeScript configuration artifacts (tsconfig*.json).
 *
 * Zero dependencies — uses native Node.js fs and path modules.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Excluded directories (dependencies, build outputs, database storage, version control)
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'mongodb-data',
  'dist',
  'build',
  'out',
  'coverage',
  '.vercel',
  '.turbo',
]);

// Prohibited TypeScript extensions and config patterns
const PROHIBITED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
]);

const PROHIBITED_CONFIG_REGEX = /^tsconfig(\..+)?\.json$/i;

function scanDirectory(dirPath, prohibitedFiles = [], scannedStats = { fileCount: 0 }, traversalErrors = []) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    const relPath = path.relative(PROJECT_ROOT, dirPath) || dirPath;
    traversalErrors.push({ path: relPath, message: err.message });
    return { prohibitedFiles, scannedStats, traversalErrors };
  }

  for (const entry of entries) {
    const entryName = entry.name;
    const fullPath = path.join(dirPath, entryName);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entryName)) {
        continue;
      }
      scanDirectory(fullPath, prohibitedFiles, scannedStats, traversalErrors);
    } else if (entry.isFile()) {
      scannedStats.fileCount += 1;
      const ext = path.extname(entryName).toLowerCase();
      const relPath = path.relative(PROJECT_ROOT, fullPath);

      // Check for prohibited TypeScript extensions
      if (PROHIBITED_EXTENSIONS.has(ext)) {
        prohibitedFiles.push({
          path: relPath,
          reason: `Prohibited TypeScript extension: "${ext}"`,
        });
      } else if (PROHIBITED_CONFIG_REGEX.test(entryName)) {
        prohibitedFiles.push({
          path: relPath,
          reason: `Prohibited TypeScript configuration file: "${entryName}"`,
        });
      }
    }
  }

  return { prohibitedFiles, scannedStats, traversalErrors };
}

function runCheck(targetRoot = PROJECT_ROOT) {
  const { prohibitedFiles, scannedStats, traversalErrors } = scanDirectory(targetRoot);

  if (traversalErrors && traversalErrors.length > 0) {
    console.error('\n[CampusFlow Architecture] ERROR: Traversal failure encountered!');
    for (const err of traversalErrors) {
      console.error(`  - Unable to read directory: ${err.path} (${err.message})`);
    }
    console.error('Cannot guarantee JavaScript-first compliance when directories are unreadable.\n');
    return false;
  }

  if (prohibitedFiles.length > 0) {
    console.error('\n[CampusFlow Architecture] VIOLATION: Prohibited TypeScript files detected!');
    console.error('CampusFlow is strictly a JavaScript-first architecture (.js, .jsx, .mjs).\n');
    console.error('Offending files:');
    for (const item of prohibitedFiles) {
      console.error(`  - ${item.path} (${item.reason})`);
    }
    console.error('\nAction required: Convert these files to native .js / .jsx, or remove them.\n');
    return false;
  }

  console.log('[CampusFlow Architecture] JavaScript-first architecture verified.');
  console.log(`  Scanned: ${scannedStats.fileCount} first-party files across workspace.`);
  console.log('  Prohibited TypeScript files: 0\n');
  return true;
}

if (require.main === module) {
  const success = runCheck();
  process.exit(success ? 0 : 1);
}

module.exports = {
  runCheck,
  scanDirectory,
  PROHIBITED_EXTENSIONS,
  PROHIBITED_CONFIG_REGEX,
  EXCLUDED_DIRS,
};
