const fs = require('fs');
const glob = require('glob');

// Fix all Google service imports
function fixGoogleServiceImports() {
  const files = glob.sync('app/api/**/*.ts');

  files.forEach((file) => {
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      let changed = false;

      // Fix Google service imports
      if (content.includes('@/lib/external/services/google-')) {
        content = content.replace(
          '@/lib/external/services/google-analytics-service',
          '@/lib/external/google-analytics-service'
        );
        content = content.replace(
          '@/lib/external/services/google-search-console-service',
          '@/lib/external/google-search-console-service'
        );
        content = content.replace(
          '@/lib/external/services/google-merchant-center-service',
          '@/lib/external/google-merchant-center-service'
        );
        changed = true;
      }

      // Fix Google encryption path
      if (content.includes('@/lib/external/google/encryption')) {
        content = content.replace('@/lib/external/google/encryption', '@/lib/external/encryption');
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(file, content);
        console.log(`✓ Fixed imports in ${file}`);
      }
    }
  });
}

// Fix database column references
function fixDatabaseColumns() {
  const files = glob.sync('app/api/**/*.ts');

  files.forEach((file) => {
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      let changed = false;

      // Fix feed_config column names
      if (content.includes('connection.type') || content.includes('connection.connection_name')) {
        content = content.replace(/connection\.type/g, 'connection.feed_type');
        content = content.replace(/connection\.connection_name/g, 'connection.feed_name');
        changed = true;
      }

      // Fix data_source_connections references
      if (content.includes('data_source_connections')) {
        content = content.replace(/data_source_connections/g, 'feed_config');
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(file, content);
        console.log(`✓ Fixed database columns in ${file}`);
      }
    }
  });
}

// Remove any remaining search_metrics references
function removeSearchMetrics() {
  const file = 'app/api/feeds/clear/route.ts';
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // Find and remove the entire search_metrics section
    const lines = content.split('\n');
    const filteredLines = lines.filter((line) => !line.includes('search_metrics'));

    fs.writeFileSync(file, filteredLines.join('\n'));
    console.log('✓ Cleaned up feeds/clear route');
  }
}

console.log('Fixing remaining TypeScript errors...\n');

fixGoogleServiceImports();
fixDatabaseColumns();
removeSearchMetrics();

console.log('\n✅ Fixes applied!');
