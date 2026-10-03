/**
 * Reanimated stringifies a near-zero alpha as 1e-7, then rejects that string
 * and crashes any color transition (OTP boxes, PIN dots, chips).
 * Expand the alpha to a fixed decimal before it is parsed again.
 */
const fs = require('fs');
const path = require('path');

const roots = [
  'src/common/style/processors/colors.ts',
  'lib/module/common/style/processors/colors.js',
];
const pkg = path.join(__dirname, '..', 'node_modules', 'react-native-reanimated');

function patch(file) {
  const full = path.join(pkg, file);
  if (!fs.existsSync(full)) return;
  let src = fs.readFileSync(full, 'utf8');
  const from = 'return `rgba(${r},${g},${b},${a})`;';
  const to = 'return `rgba(${r},${g},${b},${a.toFixed(4)})`;';
  if (src.includes(from)) src = src.replace(from, to);
  if (!src.includes("value.indexOf('e')")) {
    src = src.replace(
      "'worklet';\n\n  let result",
      `'worklet';\n\n  if (typeof value === 'string' && value.indexOf('e') !== -1) {\n    const open = value.indexOf('(');\n    const close = value.lastIndexOf(')');\n    if (open !== -1 && close > open) {\n      const parts = value.slice(open + 1, close).split(',');\n      if (parts.length === 4) {\n        const a = +parts[3];\n        const alpha = a < 0.0001 ? '0' : (Math.round(a * 10000) / 10000).toFixed(4);\n        value = \`\${value.slice(0, open + 1)}\${parts[0]},\${parts[1]},\${parts[2]},\${alpha})\`;\n      }\n    }\n  }\n  let result`,
    );
  }
  fs.writeFileSync(full, src);
}

for (const file of roots) patch(file);
