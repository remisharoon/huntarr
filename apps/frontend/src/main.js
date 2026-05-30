import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider, SignIn, SignUp, SignedIn, SignedOut, useAuth, } from '@clerk/clerk-react';
import { BrowserRouter, Navigate, Route, Routes, } from 'react-router-dom';
import App from './App';
import './index.css';
import { setApiAuthTokenResolver } from './lib/api';
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
function AuthenticatedApp() {
    const { getToken } = useAuth();
    React.useEffect(() => {
        setApiAuthTokenResolver(() => getToken());
        return () => setApiAuthTokenResolver(null);
    }, [getToken]);
    return (_jsxs(_Fragment, { children: [_jsx(SignedIn, { children: _jsx(App, {}) }), _jsx(SignedOut, { children: _jsx(Navigate, { to: "/sign-in", replace: true }) })] }));
}
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: publishableKey ? (_jsx(ClerkProvider, { publishableKey: publishableKey, children: _jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/sign-in/*", element: _jsx(SignIn, { routing: "path", path: "/sign-in", signUpUrl: "/sign-up", forceRedirectUrl: "/" }) }), _jsx(Route, { path: "/sign-up/*", element: _jsx(SignUp, { routing: "path", path: "/sign-up", signInUrl: "/sign-in", forceRedirectUrl: "/" }) }), _jsx(Route, { path: "/*", element: _jsx(AuthenticatedApp, {}) })] }) }) })) : (_jsx(BrowserRouter, { children: _jsx(App, {}) })) }));
