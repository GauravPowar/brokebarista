const fs = require('fs');
const files = ['app.js', 'index.html', 'styles.css', 'journal.html', 'log.html', 'process.html', 'add.html', 'shelf.html'];

const replacements = {
  'â‚¹': '₹',
  'Â·': '·',
  'â€”': '—',
  'â˜…': '★',
  'â˜†': '☆',
  'â˜•': '☕',
  'âœ•': '✕',
  'âœ“': '✓',
  'ðŸ““': '📓',
  'ðŸ †': '🏆',
  'ðŸ“Š': '📊',
  'ðŸ—“ï¸ ': '🗓️',
  'âš™ï¸ ': '⚙️',
  'ðŸ«™': '🫙',
  'ðŸŒ¿': '🌿',
  'ðŸ“¦': '📦',
  'ðŸ”“': '🔓',
  'ðŸ ’': '🍒',
  'ðŸ’§': '💧',
  'ðŸ ¯': '🍯',
  'âš—ï¸ ': '⚗️',
  'ðŸŒ¾': '🌾',
  'ðŸ§ª': '🧪',
  'â˜ ï¸ ': '☝️',
  'â ³': '⏳',
  'âš ï¸ ': '⚠️',
  'ðŸ“‹': '📋',
  'â†©': '↩',
  'â “': '❓',
  'âœ¨': '✨',
  'ðŸŒ™': '🌙',
  'â˜€ï¸ ': '☀️',
  'Ã—': '×',
  'cafÃ©': 'café',
  'Â°': '°',
  'â• ': '═',
  'â”€': '─'
};

for (const file of files) {
  if (fs.existsSync(file)) {
    let text = fs.readFileSync(file, 'utf8');
    let changed = false;
    for (const [bad, good] of Object.entries(replacements)) {
      if (text.includes(bad)) {
        text = text.split(bad).join(good);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(file, text, 'utf8');
      console.log('Fixed:', file);
    }
  }
}
