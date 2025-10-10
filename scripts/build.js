#!/usr/bin/env node
/**
 * Cross-platform build script
 * Compiles TypeScript and adds shebang to the output file
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '../build');
const INDEX_FILE = path.join(BUILD_DIR, 'index.js');
const SHEBANG = '#!/usr/bin/env node\n';

console.log('🔨 Building project...\n');

try {
  // Step 1: Compile TypeScript
  console.log('📦 Compiling TypeScript...');
  execSync('tsc', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation successful\n');

  // Step 2: Add shebang to index.js
  console.log('🔧 Adding shebang to index.js...');
  if (fs.existsSync(INDEX_FILE)) {
    const content = fs.readFileSync(INDEX_FILE, 'utf8');
    
    // Only add shebang if it doesn't already exist
    if (!content.startsWith('#!')) {
      fs.writeFileSync(INDEX_FILE, SHEBANG + content, 'utf8');
      console.log('✅ Shebang added successfully\n');
    } else {
      console.log('ℹ️  Shebang already exists\n');
    }

    // Step 3: Make file executable (Unix-like systems only)
    try {
      fs.chmodSync(INDEX_FILE, '755');
      console.log('✅ File permissions set (Unix/Linux/macOS)\n');
    } catch (error) {
      // chmod fails on Windows, which is expected and fine
      console.log('ℹ️  Skipping chmod (Windows environment)\n');
    }
  } else {
    throw new Error(`Build file not found: ${INDEX_FILE}`);
  }

  console.log('🎉 Build completed successfully!\n');
  process.exit(0);
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

