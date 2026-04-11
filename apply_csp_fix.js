const fs = require('fs');

['src/options/options.html', 'src/popup/popup.html'].forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/g, '');
  content = content.replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/g, '');
  content = content.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]+" rel="stylesheet">\s*/g, '');
  fs.writeFileSync(f, content, 'utf8');
});

console.log("Removed Google Fonts for CSP compliance.");