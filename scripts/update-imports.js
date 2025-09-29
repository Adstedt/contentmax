const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Mapping of old paths to new paths
const PATH_MAPPINGS = {
  '@/lib/import/': '@/lib/data/import/',
  '@/lib/ingestion/': '@/lib/data/import/',
  '@/lib/parsers/': '@/lib/data/import/',
  '@/lib/scoring/': '@/lib/core/analysis/',
  '@/lib/matching/': '@/lib/core/analysis/',
  '@/lib/recommendations/': '@/lib/core/analysis/',
  '@/lib/integration/': '@/lib/external/',
  '@/lib/integrations/': '@/lib/external/',
  '@/lib/taxonomy/': '@/lib/core/taxonomy/',
  '@/lib/supabase/': '@/lib/external/supabase/',
};

function updateImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const [oldPath, newPath] of Object.entries(PATH_MAPPINGS)) {
    if (content.includes(oldPath)) {
      content = content.replace(new RegExp(escapeRegExp(oldPath), 'g'), newPath);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
    return true;
  }
  return false;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Find all TypeScript/JavaScript files
const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
  ignore: ['node_modules/**', '.next/**', 'out/**', 'scripts/update-imports.js'],
});

let updatedCount = 0;
console.log(`Found ${files.length} files to check...`);

files.forEach(file => {
  if (updateImports(file)) {
    updatedCount++;
  }
});

console.log(`\nComplete! Updated ${updatedCount} files.`);