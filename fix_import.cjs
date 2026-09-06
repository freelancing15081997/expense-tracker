const fs = require('fs');
let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');

layout = layout.replace(
  "import { Wallet, LogOut, LayoutDashboard, Settings, Menu, X, Receipt, BookOpen, Bell, CheckCircle2, Search, FileText, CreditCard, ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react';",
  "import { Wallet, LogOut, LayoutDashboard, Settings, Menu, X, Receipt, BookOpen, Bell, CheckCircle2, Search, FileText, CreditCard, ChevronLeft, ChevronRight, Plus, Users, ArrowRightLeft } from 'lucide-react';"
);

fs.writeFileSync('src/components/Layout.tsx', layout);
