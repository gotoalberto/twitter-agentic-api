'use client';

import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import './zeus-landing.css';
import Image from 'next/image';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/hivemind');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="zeus-landing__loading">
        <div className="zeus-landing__loader"></div>
      </div>
    );
  }

  if (status === 'authenticated') {
    return (
      <div className="zeus-landing__loading">
        <div className="zeus-landing__loader"></div>
      </div>
    );
  }

  return (
    <div className="zeus-landing">
      {/* Background Effects */}
      <div className="zeus-landing__bg">
        <div className="zeus-landing__bg-gradient"></div>
        <div className="zeus-landing__bg-pattern"></div>
      </div>

      {/* Header */}
      <header className="zeus-landing__header">
        <div className="zeus-landing__header-inner">
          <div className="zeus-landing__logo">
            <img src="https://pepes.dog/assets/img/logo.webp" alt="Zeus Army" />
          </div>
          <nav className="zeus-landing__nav">
            <a href="#how-it-works">How It Works</a>
            <a href="#benefits">Benefits</a>
            <a href="#faq">FAQ</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="zeus-landing__hero">
        <div className="zeus-landing__container">
          <div className="zeus-landing__hero-content">
            <h1 className="zeus-landing__title zeus-landing__glow">
              ZEUS ARMY
            </h1>
            <p className="zeus-landing__subtitle">
              The Most Based Degen Network on X 🚀
            </p>
            <p className="zeus-landing__hero-description">
              Join the PepesDog community amplification network.
              Automated RT & Likes for every $PEPESDOG tweet.
              100x your reach, pump the timeline together!
            </p>
            <button
              onClick={() => signIn('twitter', { callbackUrl: '/hivemind' })}
              className="zeus-landing__button"
            >
              ⚡ JOIN ZEUS ARMY NOW ⚡
            </button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="zeus-landing__container">

        {/* What is Zeus Army */}
        <section className="zeus-landing__card">
          <h2 className="zeus-landing__section-title">
            WTF IS ZEUS ARMY? 🤔
          </h2>

          <div className="zeus-landing__info-box">
            <p style={{ fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', textAlign: 'center' }}>
              Imagine every PepesDog holder becoming a fucking SIGNAL AMPLIFIER 📡<br/>
              When you tweet about $PEPESDOG, HUNDREDS of accounts automatically RT & Like your shit.<br/>
              Your reach goes 100x. The algorithm loves you. WE PUMP THE TIMELINE! 🚀
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="zeus-landing__card">
          <h2 className="zeus-landing__section-title">
            Here's The Degen Science 🧪
          </h2>

          <div className="zeus-landing__grid">
            <div className="zeus-landing__info-box">
              <h3>1️⃣ JOIN THE NETWORK</h3>
              <p>
                Connect your X account. Give Zeus Army permission to RT & Like on your behalf.
                Don't worry anon, we ONLY engage with PepesDog content. No random shilling BS.
              </p>
            </div>

            <div className="zeus-landing__info-box">
              <h3>2️⃣ POST ABOUT PEPESDOG</h3>
              <p>
                Drop a tweet with "pepesdog" in it. Could be a meme, price update, or just pure hopium.
                The moment you hit send, THE ENTIRE ZEUS ARMY MOVES! ⚡
              </p>
            </div>

            <div className="zeus-landing__info-box">
              <h3>3️⃣ INSTANT AMPLIFICATION</h3>
              <p>
                BOOM! 💥 Every Zeus Army member auto-RTs and likes your tweet.
                50 members = 50 instant engagements. 500 members = 500. We grow TOGETHER!
              </p>
            </div>

            <div className="zeus-landing__info-box">
              <h3>4️⃣ ALGORITHM DOMINATION</h3>
              <p>
                X's algorithm sees massive engagement → Pushes your tweet to MORE timelines →
                More eyes on PepesDog → Price go BRRRRR 📈 Simple mafs!
              </p>
            </div>
          </div>
        </section>

        {/* The Math */}
        <section className="zeus-landing__card zeus-landing__rotate-right">
          <h2 className="zeus-landing__section-title">
            THE DEGEN MATH 🧮
          </h2>

          <div style={{
            background: 'linear-gradient(135deg, #FFE4E1 0%, #FFC1CC 100%)',
            border: '4px solid #FF6B6B',
            borderRadius: '20px',
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 5px 0 #FF6B6B, 0 8px 15px rgba(255, 107, 107, 0.3)'
          }}>
            <div style={{
              fontFamily: 'Comic Neue',
              fontSize: 'clamp(1.1rem, 2vw, 1.3rem)',
              fontWeight: '700',
              color: '#2C2C2C',
              lineHeight: '2'
            }}>
              <div>You: 500 followers → Post gets 10 likes normally 😔</div>
              <div style={{ fontSize: '1.5rem', color: '#FF6B6B', margin: '1rem 0' }}>
                ⬇️ JOIN ZEUS ARMY ⬇️
              </div>
              <div>You: 500 followers → Post gets 200+ likes from the army 🔥</div>
              <div style={{
                fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
                color: '#4BB749',
                marginTop: '1rem',
                textShadow: '2px 2px 0 rgba(0,0,0,0.1)'
              }}>
                = 20X ENGAGEMENT = ALGORITHM LOVES YOU = WE ALL MOON 🌙
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section id="benefits" className="zeus-landing__card">
          <h2 className="zeus-landing__section-title">
            Why Degens Are APEing In 🦍
          </h2>

          <div className="zeus-landing__warning">
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{
                margin: '1rem 0',
                fontFamily: 'Comic Neue',
                fontWeight: '700',
                fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                display: 'flex',
                alignItems: 'flex-start',
                color: '#2C2C2C'
              }}>
                <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>💎</span>
                <span>NO MORE SHOUTING INTO THE VOID - Every tweet gets massive reach</span>
              </li>
              <li style={{
                margin: '1rem 0',
                fontFamily: 'Comic Neue',
                fontWeight: '700',
                fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                display: 'flex',
                alignItems: 'flex-start',
                color: '#2C2C2C'
              }}>
                <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>🤝</span>
                <span>COMMUNITY STRENGTH - We rise together, no one left behind</span>
              </li>
              <li style={{
                margin: '1rem 0',
                fontFamily: 'Comic Neue',
                fontWeight: '700',
                fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                display: 'flex',
                alignItems: 'flex-start',
                color: '#2C2C2C'
              }}>
                <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>🎯</span>
                <span>LASER FOCUSED - Only PepesDog content, no random spam BS</span>
              </li>
              <li style={{
                margin: '1rem 0',
                fontFamily: 'Comic Neue',
                fontWeight: '700',
                fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                display: 'flex',
                alignItems: 'flex-start',
                color: '#2C2C2C'
              }}>
                <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>🚀</span>
                <span>FULLY AUTOMATED - Set it once, pump forever</span>
              </li>
              <li style={{
                margin: '1rem 0',
                fontFamily: 'Comic Neue',
                fontWeight: '700',
                fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                display: 'flex',
                alignItems: 'flex-start',
                color: '#2C2C2C'
              }}>
                <span style={{ marginRight: '1rem', fontSize: '1.5rem' }}>🔓</span>
                <span>FULL CONTROL - Leave anytime (but why would you lol)</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Security */}
        <section className="zeus-landing__card zeus-landing__rotate-left">
          <h2 className="zeus-landing__section-title">
            🔒 SECURITY
          </h2>
          <p style={{
            fontFamily: 'Comic Neue',
            fontSize: 'clamp(0.9rem, 1.5vw, 1.1rem)',
            color: '#2C2C2C',
            fontWeight: '700',
            textAlign: 'center',
            marginBottom: '1rem'
          }}>
            (for the paranoid anons)
          </p>

          <div className="zeus-landing__grid">
            <div className="zeus-landing__info-box" style={{ textAlign: 'center' }}>
              <p>✅ Your keys are encrypted with military-grade AES-256-GCM</p>
            </div>
            <div className="zeus-landing__info-box" style={{ textAlign: 'center' }}>
              <p>✅ We ONLY interact with tweets containing "pepesdog"</p>
            </div>
            <div className="zeus-landing__info-box" style={{ textAlign: 'center' }}>
              <p>✅ Disconnect instantly whenever you want</p>
            </div>
            <div className="zeus-landing__info-box" style={{ textAlign: 'center' }}>
              <p>✅ Open source code - verify everything yourself</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="zeus-landing__card">
          <h2 className="zeus-landing__section-title">
            Degen FAQs 🤷‍♂️
          </h2>

          <div className="zeus-landing__faq-item">
            <h4 className="zeus-landing__faq-question">
              "Is this a bot network?"
            </h4>
            <p className="zeus-landing__faq-answer">
              Nah fam, it's a COMMUNITY AMPLIFICATION NETWORK. Real accounts, real holders, real engagement.
              We just automated the support so you don't have to manually like every PepesDog tweet.
            </p>
          </div>

          <div className="zeus-landing__faq-item">
            <h4 className="zeus-landing__faq-question">
              "Can I get banned?"
            </h4>
            <p className="zeus-landing__faq-answer">
              We only engage with PepesDog content at human-like rates. No spam, no abuse.
              You're supporting your community, not breaking TOS. But DYOR, anon!
            </p>
          </div>

          <div className="zeus-landing__faq-item">
            <h4 className="zeus-landing__faq-question">
              "How many members are in Zeus Army?"
            </h4>
            <p className="zeus-landing__faq-answer">
              Growing every day! The more members, the stronger we all become.
              Early members get the most benefit as the network grows. APE IN NOW!
            </p>
          </div>

          <div className="zeus-landing__faq-item">
            <h4 className="zeus-landing__faq-question">
              "Wen moon?"
            </h4>
            <p className="zeus-landing__faq-answer">
              Soon™️. But faster with Zeus Army. More engagement = More visibility = More buyers = 🌙
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="zeus-landing__card" style={{
          background: 'linear-gradient(135deg, #FFF9E6 0%, #FFE4B5 100%)',
          border: '5px solid #FFD700',
          boxShadow: '0 8px 0 #FFD700, 0 12px 20px rgba(255, 215, 0, 0.4)',
          textAlign: 'center'
        }}>
          <h2 className="zeus-landing__section-title">
            READY TO 100X YOUR REACH?
          </h2>

          <p style={{
            fontFamily: 'Comic Neue',
            fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
            fontWeight: '700',
            marginBottom: '2rem',
            color: '#2C2C2C'
          }}>
            Join hundreds of PepesDog degens already pumping the timeline!<br/>
            <span style={{ fontSize: 'clamp(1rem, 2vw, 1.3rem)' }}>
              LFG! It's time to dominate X together! 🚀
            </span>
          </p>

          <button
            onClick={() => signIn('twitter', { callbackUrl: '/hivemind' })}
            className="zeus-landing__button"
            style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}
          >
            ⚡ JOIN ZEUS ARMY NOW ⚡
          </button>

          <p style={{
            fontFamily: 'Comic Neue',
            fontSize: '1rem',
            color: '#666',
            marginTop: '1.5rem',
            fontWeight: '700'
          }}>
            Takes 30 seconds • Free forever • Disconnect anytime
          </p>
        </section>
      </div>

      {/* Footer */}
      <footer className="zeus-landing__footer">
        <p className="zeus-landing__footer-text">
          Zeus Army Network • Part of the PepesDog Ecosystem<br/>
          Built by degens, for degens 🤝
        </p>
        <a href="/admin" className="zeus-landing__footer-link">
          [Admin Access]
        </a>
      </footer>
    </div>
  );
}