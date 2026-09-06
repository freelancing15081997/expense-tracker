const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

content = content.replace(/\{ name: 'Settings', href: '\/settings', icon: Settings \},/g, `{ name: 'Notifications', href: '#', icon: Bell, isNotification: true },
    { name: 'Settings', href: '/settings', icon: Settings },`);

fs.writeFileSync('src/components/Layout.tsx', content);
