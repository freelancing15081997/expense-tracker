import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CapacitorService } from './lib/capacitor';

CapacitorService.initialize().then(() => {
  console.log('Mobile features initialized');
}).catch(err => {
  console.error('Failed to initialize mobile features:', err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
