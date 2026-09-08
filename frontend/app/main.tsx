import React from 'react';
import { createRoot } from 'react-dom/client';
import { Router } from '@/lib/router';
import { PreviewProvider } from '@/lib/store';
import App from './App';
import '@fontsource-variable/inter';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <PreviewProvider>
        <App />
      </PreviewProvider>
    </Router>
  </React.StrictMode>
);
