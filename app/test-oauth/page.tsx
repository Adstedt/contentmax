'use client';

import { useState } from 'react';

export default function TestOAuthPage() {
  const [authUrl, setAuthUrl] = useState('');

  const generateAuthUrl = () => {
    const params = new URLSearchParams({
      client_id: '1023065173174-t7g69et4i88i3m2h1eo1v7489034reid.apps.googleusercontent.com',
      redirect_uri: 'http://localhost:3000/api/integrations/google/callback',
      response_type: 'code',
      scope: [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/content',
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/analytics.readonly'
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: Buffer.from(JSON.stringify({
        userId: 'bypass-check', // Special value to bypass user check for testing
        timestamp: Date.now(),
        returnUrl: '/settings/integrations'
      })).toString('base64')
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    setAuthUrl(url);
    window.location.href = url;
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">OAuth Test Page</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800">
          This is a test page to debug Google OAuth. Click the button below to test the OAuth flow directly.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">OAuth Configuration:</h2>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="inline font-medium">Client ID:</dt>
              <dd className="inline ml-2 font-mono text-xs">...reid.apps.googleusercontent.com</dd>
            </div>
            <div>
              <dt className="inline font-medium">Redirect URI:</dt>
              <dd className="inline ml-2 font-mono text-xs">http://localhost:3000/api/integrations/google/callback</dd>
            </div>
            <div>
              <dt className="inline font-medium">Scopes:</dt>
              <dd className="ml-2 font-mono text-xs">openid, email, profile, content, search console, analytics</dd>
            </div>
          </dl>
        </div>

        <button
          onClick={generateAuthUrl}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Test Google OAuth Flow
        </button>

        {authUrl && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <p className="text-sm font-medium mb-2">Generated Auth URL:</p>
            <p className="text-xs font-mono break-all">{authUrl}</p>
          </div>
        )}
      </div>
    </div>
  );
}