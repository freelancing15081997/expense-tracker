const fs = require('fs');

let content = fs.readFileSync('firestore.rules', 'utf8');

// Replace isMember function
content = content.replace(
  /function isMember\(\) \{\s*return isAuthenticated\(\) && \('roles' in resource\.data\) && \(request\.auth\.uid in resource\.data\.roles\);\s*\}/,
  `function isMember() {
        return isAuthenticated() && 
               resource.data.roles[request.auth.uid].role in ['owner', 'admin', 'contributor', 'viewer', 'auditor'];
      }`
);

// We need to also add email check fallback in invites just in case
content = content.replace(
  /function getEmail\(\) \{\s*return \('email' in request\.auth\.token\) \? request\.auth\.token\.email : '';\s*\}/,
  `function getEmail() {
        return ('email' in request.auth.token) ? request.auth.token.email : '';
      }`
);

fs.writeFileSync('firestore.rules', content);
console.log("Rules fixed!");
