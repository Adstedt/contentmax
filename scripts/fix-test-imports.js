const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Define import path mappings for tests
const TEST_PATH_MAPPINGS = {
  '../lib/processing/taxonomy-builder': '@/lib/core/taxonomy/taxonomy-builder',
  '../lib/processing/hierarchy-analyzer': '@/lib/core/analysis/hierarchy-analyzer',
  '../lib/processing/gap-analyzer': '@/lib/core/analysis/gap-analyzer',
  '../lib/processing/similarity-calculator': '@/lib/core/analysis/similarity-calculator',
  '../lib/processing/processing-queue': '@/lib/data/import/processing-queue',
  '@/lib/external/url-matcher': '@/lib/external/url-matcher',
};

// Process test files
function fixTestImports() {
  const testFiles = glob.sync('tests/**/*.test.ts');

  testFiles.forEach((file) => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    Object.entries(TEST_PATH_MAPPINGS).forEach(([oldPath, newPath]) => {
      const regex = new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      if (content.includes(oldPath)) {
        content = content.replace(regex, newPath);
        changed = true;
      }
    });

    if (changed) {
      fs.writeFileSync(file, content);
      console.log(`✓ Fixed imports in ${file}`);
    }
  });
}

fixTestImports();
console.log('Test import fixes complete!');
