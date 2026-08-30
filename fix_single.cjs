const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    if (fs.statSync(file).isDirectory()) results = results.concat(walk(file));
    else if (file.endsWith('.ts')) results.push(file);
  });
  return results;
}
const files = [...walk('server'), ...walk('api')];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/from '(\.\.?\/[^']+)'/g, function(match, p1) {
    if (!p1.endsWith('.js')) return "from '" + p1 + ".js'";
    return match;
  });
  content = content.replace(/import\('(\.\.?\/[^']+)'\)/g, function(match, p1) {
    if (!p1.endsWith('.js')) return "import('" + p1 + ".js')";
    return match;
  });
  fs.writeFileSync(file, content, 'utf8');
}
console.log("Single quote imports fixed");
