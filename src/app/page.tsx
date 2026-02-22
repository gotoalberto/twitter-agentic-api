'use client';

import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import './hivemind/zeus-army.css';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // If authenticated, redirect to hivemind dashboard
    if (status === 'authenticated') {
      router.push('/hivemind');
    }
  }, [status, router]);

  if (status === 'loading') {
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

  // If already authenticated, show loading while redirecting
  if (status === 'authenticated') {
    return (
      <div className="zeus-bg">
        <div className="zeus-container">
          <div className="zeus-hero">
            <h1 className="zeus-title">ENTERING THE ARMY...</h1>
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
          <h1 className="zeus-title" style={{ fontSize: 'clamp(4rem, 10vw, 8rem)' }}>ZEUS ARMY</h1>
          <p className="zeus-subtitle" style={{ fontSize: '2rem' }}>
            The Most Powerful Degen Network on X
          </p>
          <p style={{
            fontFamily: 'Comic Neue',
            fontSize: '1.3rem',
            color: '#FFD700',
            textShadow: '2px 2px 0 #000',
            marginTop: '1rem',
            fontWeight: '700'
          }}>
            PepesDog Community • Automated Amplification • Collective Domination
          </p>
        </div>

        {/* Main Card */}
        <div className="zeus-card" style={{ maxWidth: '1000px', margin: '2rem auto' }}>

          {/* What is Zeus Army Section */}
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{
              fontFamily: 'GROBOLD',
              fontSize: '3.5rem',
              textAlign: 'center',
              background: 'linear-gradient(90deg, #FF6B6B 0%, #FFD700 50%, #1E90FF 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '2rem',
              textTransform: 'uppercase'
            }}>
              WTF IS ZEUS ARMY?
            </h2>

            <div style={{
              background: 'linear-gradient(135deg, #FFF9E6 0%, #FFE4B5 100%)',
              border: '4px solid #FFD700',
              borderRadius: '20px',
              padding: '2rem',
              boxShadow: '0 5px 0 #FFD700, 0 8px 15px rgba(255, 215, 0, 0.3)',
              marginBottom: '2rem'
            }}>
              <p style={{
                fontFamily: 'Comic Neue',
                fontSize: '1.4rem',
                fontWeight: '700',
                color: '#2C2C2C',
                lineHeight: '1.8',
                textAlign: 'center'
              }}>
                Imagine every PepesDog holder becoming a fucking SIGNAL AMPLIFIER 📡<br/>
                When you tweet about $PEPESDOG, HUNDREDS of accounts automatically RT & Like your shit.<br/>
                Your reach goes 100x. The algorithm loves you. WE PUMP THE TIMELINE! 🚀
              </p>
            </div>
          </div>

          {/* How It Works Grid */}
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{
              fontFamily: 'BreakingTheComic',
              fontSize: '2.5rem',
              textAlign: 'center',
              color: '#FFD700',
              textShadow: '3px 3px 0 #000',
              marginBottom: '2rem',
              textTransform: 'uppercase'
            }}>
              Here's The Degen Science 🧪
            </h2>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {/* Step 1 */}
              <div className="zeus-info-box" style={{
                background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)',
                borderColor: '#4BB749'
              }}>
                <h4 style={{ fontSize: '1.8rem' }}>1️⃣ JOIN THE NETWORK</h4>
                <p style={{ fontFamily: 'Comic Neue', fontSize: '1.2rem', fontWeight: '700', color: '#2C2C2C' }}>
                  Connect your X account. Give Zeus Army permission to RT & Like on your behalf.
                  Don't worry anon, we ONLY engage with PepesDog content. No random shilling bullshit.
                </p>
              </div>

              {/* Step 2 */}
              <div className="zeus-info-box" style={{
                background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
                borderColor: '#1E90FF'
              }}>
                <h4 style={{ fontSize: '1.8rem' }}>2️⃣ POST ABOUT PEPESDOG</h4>
                <p style={{ fontFamily: 'Comic Neue', fontSize: '1.2rem', fontWeight: '700', color: '#2C2C2C' }}>
                  Drop a tweet with "pepesdog" in it. Could be a meme, price update, or just pure hopium.
                  The moment you hit send, THE ENTIRE ZEUS ARMY MOVES! ⚡
                </p>
              </div>

              {/* Step 3 */}
              <div className="zeus-info-box" style={{
                background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
                borderColor: '#FF9800'
              }}>
                <h4 style={{ fontSize: '1.8rem' }}>3️⃣ INSTANT AMPLIFICATION</h4>
                <p style={{ fontFamily: 'Comic Neue', fontSize: '1.2rem', fontWeight: '700', color: '#2C2C2C' }}>
                  BOOM! 💥 Every Zeus Army member auto-RTs and likes your tweet.
                  50 members = 50 instant engagements. 500 members = 500. We grow TOGETHER!
                </p>
              </div>

              {/* Step 4 */}
              <div className="zeus-info-box" style={{
                background: 'linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)',
                borderColor: '#9C27B0'
              }}>
                <h4 style={{ fontSize: '1.8rem' }}>4️⃣ ALGORITHM DOMINATION</h4>
                <p style={{ fontFamily: 'Comic Neue', fontSize: '1.2rem', fontWeight: '700', color: '#2C2C2C' }}>
                  X's algorithm sees massive engagement → Pushes your tweet to MORE timelines →
                  More eyes on PepesDog → Price go BRRRRR 📈 Simple mafs!
                </p>
              </div>
            </div>
          </div>

          {/* The Degen Math */}
          <div style={{
            background: 'linear-gradient(135deg, #FFE4E1 0%, #FFC1CC 100%)',
            border: '4px solid #FF6B6B',
            borderRadius: '20px',
            padding: '2rem',
            marginBottom: '3rem',
            boxShadow: '0 5px 0 #FF6B6B, 0 8px 15px rgba(255, 107, 107, 0.3)'
          }}>
            <h3 style={{
              fontFamily: 'GROBOLD',
              fontSize: '2rem',
              textAlign: 'center',
              color: '#FF6B6B',
              marginBottom: '1.5rem'
            }}>
              THE DEGEN MATH 🧮
            </h3>
            <div style={{
              fontFamily: 'Comic Neue',
              fontSize: '1.3rem',
              fontWeight: '700',
              color: '#2C2C2C',
              textAlign: 'center',
              lineHeight: '2'
            }}>
              <div>You: 500 followers → Post gets 10 likes normally</div>
              <div style={{ fontSize: '1.5rem', color: '#FF6B6B', margin: '1rem 0' }}>⬇️ JOIN ZEUS ARMY ⬇️</div>
              <div>You: 500 followers → Post gets 200+ likes from the army</div>
              <div style={{
                fontSize: '1.8rem',
                color: '#4BB749',
                marginTop: '1rem',
                textShadow: '2px 2px 0 rgba(0,0,0,0.1)'
              }}>
                = 20X ENGAGEMENT = ALGORITHM LOVES YOU = WE ALL MOON 🌙
              </div>
            </div>
          </div>

          {/* Why This Works */}
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{
              fontFamily: 'BreakingTheComic',
              fontSize: '2.5rem',
              textAlign: 'center',
              color: '#1E90FF',
              textShadow: '3px 3px 0 #000',
              marginBottom: '2rem',
              textTransform: 'uppercase'
            }}>
              Why Degens Are APEing In 🦍
            </h2>

            <div className="zeus-warning" style={{ marginBottom: '1.5rem' }}>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li style={{
                  margin: '1rem 0',
                  fontFamily: 'Comic Neue',
                  fontWeight: '700',
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'flex-start'
                }}>
                  <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>💎</span>
                  <span>NO MORE SHOUTING INTO THE VOID - Every tweet gets massive reach</span>
                </li>
                <li style={{
                  margin: '1rem 0',
                  fontFamily: 'Comic Neue',
                  fontWeight: '700',
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'flex-start'
                }}>
                  <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>🤝</span>
                  <span>COMMUNITY STRENGTH - We rise together, no one left behind</span>
                </li>
                <li style={{
                  margin: '1rem 0',
                  fontFamily: 'Comic Neue',
                  fontWeight: '700',
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'flex-start'
                }}>
                  <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>🎯</span>
                  <span>LASER FOCUSED - Only PepesDog content, no random spam BS</span>
                </li>
                <li style={{
                  margin: '1rem 0',
                  fontFamily: 'Comic Neue',
                  fontWeight: '700',
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'flex-start'
                }}>
                  <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>🚀</span>
                  <span>FULLY AUTOMATED - Set it once, pump forever</span>
                </li>
                <li style={{
                  margin: '1rem 0',
                  fontFamily: 'Comic Neue',
                  fontWeight: '700',
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'flex-start'
                }}>
                  <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>🔓</span>
                  <span>FULL CONTROL - Leave anytime (but why would you lol)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Security Notice */}
          <div style={{
            background: 'linear-gradient(135deg, #E8EAF6 0%, #C5CAE9 100%)',
            border: '4px solid #3F51B5',
            borderRadius: '20px',
            padding: '2rem',
            marginBottom: '3rem',
            boxShadow: '0 5px 0 #3F51B5, 0 8px 15px rgba(63, 81, 181, 0.3)'
          }}>
            <h3 style={{
              fontFamily: 'BreakingTheComic',
              fontSize: '1.8rem',
              color: '#3F51B5',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              🔒 SECURITY (for the paranoid anons)
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              fontFamily: 'Comic Neue',
              fontSize: '1.15rem',
              fontWeight: '700',
              color: '#2C2C2C'
            }}>
              <li style={{ margin: '0.8rem 0' }}>
                ✅ Your keys are encrypted with military-grade AES-256-GCM
              </li>
              <li style={{ margin: '0.8rem 0' }}>
                ✅ We ONLY interact with tweets containing "pepesdog"
              </li>
              <li style={{ margin: '0.8rem 0' }}>
                ✅ Disconnect instantly whenever you want
              </li>
              <li style={{ margin: '0.8rem 0' }}>
                ✅ Open source code - verify everything yourself
              </li>
            </ul>
          </div>

          {/* Call to Action */}
          <div style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            background: 'linear-gradient(135deg, #FFF9E6 0%, #FFE4B5 100%)',
            borderRadius: '20px',
            border: '5px solid #FFD700',
            boxShadow: '0 8px 0 #FFD700, 0 12px 20px rgba(255, 215, 0, 0.4)',
            transform: 'rotate(-1deg)'
          }}>
            <h2 style={{
              fontFamily: 'GROBOLD',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              background: 'linear-gradient(90deg, #FF6B6B 0%, #FFD700 50%, #4BB749 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '1.5rem',
              textTransform: 'uppercase'
            }}>
              READY TO 100X YOUR REACH?
            </h2>
            <p style={{
              fontFamily: 'Comic Neue',
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '2rem',
              color: '#2C2C2C'
            }}>
              Join hundreds of PepesDog degens already pumping the timeline!<br/>
              <span style={{ fontSize: '1.3rem' }}>LFG! It's time to dominate X together! 🚀</span>
            </p>
            <button
              onClick={() => signIn('twitter', { callbackUrl: '/hivemind' })}
              className="zeus-button"
              style={{
                fontSize: '2rem',
                padding: '1.8rem 4rem',
                marginBottom: '1rem'
              }}
            >
              ⚡ JOIN ZEUS ARMY NOW ⚡
            </button>
            <p style={{
              fontFamily: 'Comic Neue',
              fontSize: '1rem',
              color: '#666',
              marginTop: '1rem',
              fontWeight: '700'
            }}>
              Takes 30 seconds • Free forever • Disconnect anytime
            </p>
          </div>

          {/* FAQ Section */}
          <div style={{ marginTop: '3rem' }}>
            <h2 style={{
              fontFamily: 'BreakingTheComic',
              fontSize: '2rem',
              textAlign: 'center',
              color: '#FFD700',
              textShadow: '2px 2px 0 #000',
              marginBottom: '2rem'
            }}>
              Degen FAQs
            </h2>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{
                background: '#FFF',
                border: '3px solid #FFD700',
                borderRadius: '15px',
                padding: '1.5rem',
                boxShadow: '0 3px 0 #FFD700'
              }}>
                <h4 style={{
                  fontFamily: 'BreakingTheComic',
                  fontSize: '1.3rem',
                  color: '#FF6B6B',
                  marginBottom: '0.5rem'
                }}>
                  "Is this a bot network?"
                </h4>
                <p style={{ fontFamily: 'Comic Neue', fontSize: '1.1rem', fontWeight: '700' }}>
                  Nah fam, it's a COMMUNITY AMPLIFICATION NETWORK. Real accounts, real holders, real engagement.
                  We just automated the support so you don't have to manually like every PepesDog tweet.
                </p>
              </div>

              <div style={{
                background: '#FFF',
                border: '3px solid #FFD700',
                borderRadius: '15px',
                padding: '1.5rem',
                boxShadow: '0 3px 0 #FFD700'
              }}>
                <h4 style={{
                  fontFamily: 'BreakingTheComic',
                  fontSize: '1.3rem',
                  color: '#1E90FF',
                  marginBottom: '0.5rem'
                }}>
                  "Can I get banned?"
                </h4>
                <p style={{ fontFamily: 'Comic Neue', fontSize: '1.1rem', fontWeight: '700' }}>
                  We only engage with PepesDog content at human-like rates. No spam, no abuse.
                  You're supporting your community, not breaking TOS. But DYOR, anon!
                </p>
              </div>

              <div style={{
                background: '#FFF',
                border: '3px solid #FFD700',
                borderRadius: '15px',
                padding: '1.5rem',
                boxShadow: '0 3px 0 #FFD700'
              }}>
                <h4 style={{
                  fontFamily: 'BreakingTheComic',
                  fontSize: '1.3rem',
                  color: '#4BB749',
                  marginBottom: '0.5rem'
                }}>
                  "Wen moon?"
                </h4>
                <p style={{ fontFamily: 'Comic Neue', fontSize: '1.1rem', fontWeight: '700' }}>
                  Soon™️. But faster with Zeus Army. More engagement = More visibility = More buyers = 🌙
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '3rem', paddingBottom: '2rem' }}>
          <p style={{
            fontFamily: 'Comic Neue',
            fontSize: '1.2rem',
            color: '#FFD700',
            textShadow: '2px 2px 0 #000',
            fontWeight: '700',
            marginBottom: '1rem'
          }}>
            Zeus Army Network • Part of the PepesDog Ecosystem<br/>
            Built by degens, for degens 🤝
          </p>
          <a
            href="/admin"
            style={{
              fontFamily: 'Comic Neue',
              fontSize: '0.9rem',
              color: '#FFD700',
              textShadow: '1px 1px 0 #000',
              fontWeight: '700',
              textDecoration: 'none',
              opacity: 0.7,
              transition: 'opacity 0.3s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >
            [Admin Access]
          </a>
        </div>
      </div>
    </div>
  );
}