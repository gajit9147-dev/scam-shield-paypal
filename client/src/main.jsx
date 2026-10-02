import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import PayGuard from './PayGuard.jsx';
import './index.css';

const onPayPage = window.location.pathname === '/pay' || window.location.hash === '#/pay';

createRoot(document.getElementById('root')).render(<React.StrictMode>{onPayPage ? <PayGuard /> : <App />}</React.StrictMode>);
