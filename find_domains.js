const fs = require('fs');
const glob = require('glob'); // Note: we have glob in standard node if we use naive traversal, but we can just use child_process.execSync
const { execSync } = require('child_process');

try {
  const result = execSync('git grep -h -o -E "https?://[^/\\\\'\\"]+" src/', { encoding: 'utf8' });
  const domains = Array.from(new Set(result.split('\\n').filter(Boolean))).sort();
  console.log(domains.join('\\n'));
} catch (e) {
  console.log("Error finding domains:", e.message);
}