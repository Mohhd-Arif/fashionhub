import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import AdminApp from './admin/AdminApp';
import Storefront from './storefront/Storefront';

const accountPage = /^\/(admin|login)\/?$/.test(window.location.pathname);
createRoot(document.getElementById('root')).render(<React.StrictMode>{accountPage ? <AdminApp /> : <Storefront />}</React.StrictMode>);
