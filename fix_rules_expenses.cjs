const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

// Update expenses rule
content = content.replace(
  /function isBookMember\(\) \{[\s\S]*?\}/,
  `function isBookMember() {
          return get(/databases/$(database)/documents/books/$(bookId)).data.roles[request.auth.uid].role in ['owner', 'admin', 'contributor', 'viewer', 'auditor'];
        }`
);

fs.writeFileSync('firestore.rules', content);
console.log("Expenses rule updated!");
