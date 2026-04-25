const fs = require("fs");
const path = require("path");

// folders to ignore
const IGNORE_DIRS = ["node_modules", ".git", "dist", "build"];

// replace rules
const replacements = [
  {
    from: /new:\s*true/g,
    to: 'returnDocument: "after"'
  }
];

function walk(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);

    if (IGNORE_DIRS.includes(file)) continue;

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith(".js")) {
      let content = fs.readFileSync(fullPath, "utf8");
      let original = content;

      for (const rule of replacements) {
        content = content.replace(rule.from, rule.to);
      }

      if (content !== original) {
        fs.writeFileSync(fullPath, content, "utf8");
        console.log("✔ Fixed:", fullPath);
      }
    }
  }
}

console.log("🚀 Starting Mongoose auto-fix...");
walk(process.cwd());
console.log("✅ Done!");