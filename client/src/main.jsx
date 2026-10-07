import React from 'react';
import { createRoot } from 'react-dom/client';
import PayGuard from './PayGuard.jsx';
import './index.css';

// One main page; /pay remains a compatible direct link.
createRoot(document.getElementById('root')).render(<React.StrictMode><PayGuard /></React.StrictMode>);
