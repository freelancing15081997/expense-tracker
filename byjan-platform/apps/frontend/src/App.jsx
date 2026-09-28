import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BizLogic from './logic/BizLogic.js';
import AppShell from './layout/AppShell.jsx';
import TraceConsole from './components/TraceConsole.jsx';
import { getAccessToken } from './lib/api.js';

export default class App extends BizLogic {
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
