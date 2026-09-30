import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BizLogic from './logic/BizLogic.js';
import AppShell from './layout/AppShell.jsx';
import TraceConsole from './components/TraceConsole.jsx';
import { getAccessToken } from './lib/api.js';

const inis = n => (n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

// props: user (signed-in user from AuthGate), onAskSignOut()
export default class App extends BizLogic {
  renderVals() {
    const v = super.renderVals();
    const u = this.props.user;
    const close = fn => () => { this.setState({ pm: false }); fn && fn(); };
    if (u) v.me = Object.assign({}, v.me, { n: u.name, ini: inis(u.name), r: u.role || (v.me && v.me.r) });
    v.meSub = u ? (u.email || u.phone || '') : '';
    v.pm = !!this.state.pm;
    v.togglePm = () => this.setState(s => ({ pm: !s.pm, ws: false, bell: false, newOpen: false }));
    v.pmItems = [
      { n: 'My profile', ic: 'duotone/user-circle-duotone.svg', go: close(v.goSettings) },
      { n: 'Devices and sessions', ic: 'duotone/devices-duotone.svg', go: close(v.goSettings) },
      { n: 'Switch workspace', ic: 'duotone/arrows-left-right-duotone.svg', go: close(v.toggleWs) },
    ];
    v.signOut = close(this.props.onAskSignOut);
    return v;
  }

  render() {
    // Check if user is authenticated
    const isAuthenticated = !!getAccessToken();

    return (
      <BrowserRouter>
        <Routes>
          {/* Main app route */}
          <Route
            path="/"
            element={<AppShell v={this.renderVals()} />}
          />

          {/* Trace Console route - accessible to super-users only */}
          <Route
            path="/console"
            element={
              isAuthenticated ? (
                <TraceConsole />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Login route */}
          <Route
            path="/login"
            element={
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-3xl font-bold text-gray-900 mb-4">Byjan Business</h1>
                  <p className="text-gray-600 mb-8">Please log in to continue</p>
                  <button
                    onClick={() => {
                      // TODO: Implement Firebase login
                      console.log('Firebase login');
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Login with Firebase
                  </button>
                </div>
              </div>
            }
          />

          {/* 404 route */}
          <Route
            path="*"
            element={
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                  <p className="text-gray-600">Page not found</p>
                </div>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    );
  }
}
