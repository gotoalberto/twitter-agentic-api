'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import './zeus-army.css';

export default function HivemindDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hivemindStatus, setHivemindStatus] = useState<any>(null);

  useEffect(() => {
    // If not authenticated, redirect to login
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    // Check if user is connected to Hivemind
    const checkHivemindStatus = async () => {
      if (session?.user) {
        try {
          const response = await fetch('/api/hivemind/status');
          if (response.ok) {
            const data = await response.json();
            setIsConnected(data.isConnected);
            setHivemindStatus(data);
          }
        } catch (error) {
          console.error('Error checking Hivemind status:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    if (status === 'authenticated') {
      checkHivemindStatus();
    }
  }, [session, status]);

  const handleJoinHivemind = async () => {
    try {
      // Redirect to OAuth flow for Hivemind
      window.location.href = '/api/hivemind/authorize';
    } catch (error) {
      console.error('Error joining Hivemind:', error);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to leave the Zeus Army Network? You can rejoin anytime!')) {
      return;
    }

    try {
      const response = await fetch('/api/hivemind/disconnect', {
        method: 'POST'
      });

      if (response.ok) {
        setIsConnected(false);
        setHivemindStatus(null);
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      console.error('Error disconnecting from Hivemind:', error);
      alert('Failed to disconnect from Zeus Army. Please try again.');
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="zeus-bg">
        <div className="zeus-container">
          <div className="zeus-hero">
            <h1 className="zeus-title">Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="zeus-bg">
        <div className="zeus-container">
          <div className="zeus-hero">
            <h1 className="zeus-title">Redirecting...</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="zeus-bg">
      <div className="zeus-container">
        {/* Hero Section */}
        <div className="zeus-hero">
          <h1 className="zeus-title">ZEUS ARMY</h1>
          <p className="zeus-subtitle">Unite for PepesDog • Amplify Together • Win as One</p>
        </div>

        {/* Main Card */}
        <div className="zeus-card">
          {/* Header with user info */}
          <div className="zeus-header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h2 className="zeus-welcome-title" style={{ fontFamily: 'BreakingTheComic', fontSize: '2rem', color: '#2C2C2C', textTransform: 'uppercase' }}>
                Welcome, Soldier!
              </h2>
              <p className="zeus-username" style={{ fontFamily: 'Comic Neue', fontSize: '1.2rem', color: '#666', fontWeight: '700' }}>
                @{session?.user?.username || session?.user?.name}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="zeus-button zeus-button-secondary zeus-signout-btn"
              style={{ fontSize: '1rem', padding: '0.8rem 1.5rem' }}
            >
              Sign Out
            </button>
          </div>

          {/* Connection Status */}
          <div className={`zeus-status ${!isConnected ? 'disconnected' : ''}`}>
            <div className="zeus-status-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="zeus-status-title" style={{ fontSize: '1.8rem', marginBottom: '0.5rem', fontFamily: 'BreakingTheComic' }}>
                  {isConnected ? '⚡ ZEUS ARMY ACTIVATED ⚡' : '🛡️ JOIN THE ZEUS ARMY'}
                </h3>
                <p className="zeus-status-desc" style={{ fontSize: '1.1rem', opacity: 0.95 }}>
                  {isConnected
                    ? `Connected as @${hivemindStatus?.username} • Active since ${new Date(hivemindStatus?.connectedAt).toLocaleDateString()}`
                    : 'Connect your Twitter to join the most powerful crypto army on X!'}
                </p>
              </div>
              {!isConnected ? (
                <button
                  onClick={handleJoinHivemind}
                  className="zeus-button zeus-action-btn"
                  style={{ marginLeft: '2rem' }}
                >
                  JOIN NOW ⚡
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="zeus-button zeus-button-danger zeus-action-btn"
                  style={{ marginLeft: '2rem' }}
                >
                  DISCONNECT
                </button>
              )}
            </div>
          </div>

          {/* How it works section */}
          <div className="zeus-section">
            <h2 className="zeus-how-it-works" style={{
              fontFamily: 'GROBOLD',
              fontSize: '3rem',
              textAlign: 'center',
              background: 'linear-gradient(90deg, #FFD700 0%, #FF6B6B 50%, #1E90FF 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '2rem',
              textTransform: 'uppercase',
              lineHeight: '1.2'
            }}>
              How Zeus Army Works
            </h2>

            <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* What you get */}
              <div className="zeus-info-box" style={{ background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)', borderColor: '#4BB749' }}>
                <h4>🚀 YOUR BENEFITS</h4>
                <ul className="zeus-list">
                  <li className="zeus-list-item">
                    <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>💎</span>
                    <span>Automatic RT & Likes from ALL Zeus Army members on your PepesDog tweets</span>
                  </li>
                  <li className="zeus-list-item">
                    <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>📈</span>
                    <span>Massive reach amplification - Your tweets seen by thousands more</span>
                  </li>
                  <li className="zeus-list-item">
                    <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>🏆</span>
                    <span>Higher engagement = Better algorithm ranking = More visibility</span>
                  </li>
                  <li className="zeus-list-item">
                    <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>🤝</span>
                    <span>Be part of the strongest crypto community on Twitter</span>
                  </li>
                </ul>
              </div>

              {/* How you contribute */}
              <div className="zeus-info-box" style={{ background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)', borderColor: '#1E90FF' }}>
                <h4>🤖 YOUR CONTRIBUTION</h4>
                <ul className="zeus-list">
                  <li className="zeus-list-item">
                    <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>♻️</span>
                    <span>Your account auto-RTs & likes fellow members' PepesDog content</span>
                  </li>
                  <li className="zeus-list-item">
                    <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>🎯</span>
                    <span>Only tweets with "pepesdog" keyword are engaged - focused support</span>
                  </li>
                  <li className="zeus-list-item">
                    <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>⚡</span>
                    <span>Fully automated - Set it and forget it!</span>
                  </li>
                  <li className="zeus-list-item">
                    <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>💪</span>
                    <span>Together we dominate the Twitter algorithm</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Important notice */}
            <div className="zeus-warning">
              <h4>⚠️ IMPORTANT INFORMATION</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li style={{ margin: '0.5rem 0', fontFamily: 'Comic Neue', fontWeight: '700', fontSize: '1.05rem', color: '#2C2C2C' }}>
                  Only "pepesdog" tweets are automatically engaged
                </li>
                <li style={{ margin: '0.5rem 0', fontFamily: 'Comic Neue', fontWeight: '700', fontSize: '1.05rem', color: '#2C2C2C' }}>
                  Your credentials are encrypted with military-grade security
                </li>
                <li style={{ margin: '0.5rem 0', fontFamily: 'Comic Neue', fontWeight: '700', fontSize: '1.05rem', color: '#2C2C2C' }}>
                  You can disconnect anytime - Full control remains yours
                </li>
                <li style={{ margin: '0.5rem 0', fontFamily: 'Comic Neue', fontWeight: '700', fontSize: '1.05rem', color: '#2C2C2C' }}>
                  The more members, the stronger we all become!
                </li>
              </ul>
            </div>

            {/* Permissions Display (when connected) */}
            {isConnected && (
              <div className="zeus-section">
                <h3 style={{
                  fontFamily: 'BreakingTheComic',
                  fontSize: '2rem',
                  textAlign: 'center',
                  color: '#FFD700',
                  textTransform: 'uppercase',
                  marginBottom: '2rem',
                  textShadow: '3px 3px 0 #000'
                }}>
                  Active Permissions
                </h3>

                <div className="zeus-permissions-grid">
                  <div className="zeus-permission-card">
                    <div className="icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h4 style={{ fontFamily: 'BreakingTheComic', fontSize: '1.2rem', marginBottom: '0.5rem', color: '#2C2C2C' }}>TWEET POWER</h4>
                    <p style={{ fontFamily: 'Comic Neue', fontWeight: '700', fontSize: '0.95rem', color: '#2C2C2C' }}>
                      Post & RT tweets
                    </p>
                  </div>

                  <div className="zeus-permission-card">
                    <div className="icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <h4 style={{ fontFamily: 'BreakingTheComic', fontSize: '1.2rem', marginBottom: '0.5rem', color: '#2C2C2C' }}>LIKE FORCE</h4>
                    <p style={{ fontFamily: 'Comic Neue', fontWeight: '700', fontSize: '0.95rem', color: '#2C2C2C' }}>
                      Auto-like content
                    </p>
                  </div>

                  <div className="zeus-permission-card">
                    <div className="icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <h4 style={{ fontFamily: 'BreakingTheComic', fontSize: '1.2rem', marginBottom: '0.5rem', color: '#2C2C2C' }}>ARMY UNITY</h4>
                    <p style={{ fontFamily: 'Comic Neue', fontWeight: '700', fontSize: '0.95rem', color: '#2C2C2C' }}>
                      Support community
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Call to action */}
            {!isConnected && (
              <div style={{
                textAlign: 'center',
                marginTop: '3rem',
                padding: '2rem',
                background: 'linear-gradient(135deg, #FFF9E6 0%, #FFE4B5 100%)',
                borderRadius: '20px',
                border: '3px solid #FFD700',
                boxShadow: '0 5px 0 #FFD700, 0 8px 15px rgba(255, 215, 0, 0.3)'
              }}>
                <h2 className="zeus-ready-title" style={{
                  fontFamily: 'GROBOLD',
                  fontSize: '2.5rem',
                  background: 'linear-gradient(90deg, #FF6B6B 0%, #FFD700 50%, #4BB749 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: '1rem',
                  lineHeight: '1.2'
                }}>
                  READY TO JOIN?
                </h2>
                <p style={{
                  fontFamily: 'Comic Neue',
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  marginBottom: '2rem',
                  color: '#2C2C2C'
                }}>
                  Connect your Twitter and become part of the Zeus Army!<br/>
                  Together, we make PepesDog unstoppable! 🚀
                </p>
                <button
                  onClick={handleJoinHivemind}
                  className="zeus-button"
                  style={{ fontSize: '1.8rem', padding: '1.5rem 3rem' }}
                >
                  ⚡ JOIN ZEUS ARMY ⚡
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '3rem', paddingBottom: '2rem' }}>
          <p style={{
            fontFamily: 'Comic Neue',
            fontSize: '1rem',
            color: '#FFD700',
            textShadow: '1px 1px 0 #000',
            fontWeight: '700'
          }}>
            Zeus Army Network • Part of the PepesDog Ecosystem<br/>
            Powered by X Forwarder Technology
          </p>
        </div>
      </div>
    </div>
  );
}