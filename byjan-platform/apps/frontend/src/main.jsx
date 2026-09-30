import React from 'react';
import { createRoot } from 'react-dom/client';
import AuthGate from './auth/AuthGate.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(<AuthGate />);
