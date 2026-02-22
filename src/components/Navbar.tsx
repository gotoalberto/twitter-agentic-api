'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import './navbar.css';

const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [utilitiesOpen, setUtilitiesOpen] = useState(false);

  return (
    <nav className="zeus-navbar">
      <div className="zeus-navbar-container">
        <a href="https://pepes.dog" className="zeus-navbar-logo">
          <img src="https://pepes.dog/zeus.jpg" alt="Zeus" />
          <span className="zeus-navbar-logo-text">
            Pepe's Dog <span className="zeus-navbar-logo-army">Army</span>
          </span>
        </a>

        <div className="zeus-navbar-links">
          <a href="https://pepes.dog#about" className="zeus-navbar-link">About</a>
          <a href="https://pepes.dog#roadmap" className="zeus-navbar-link">Roadmap</a>
          <a href="https://pepes.dog#tokenomics" className="zeus-navbar-link">Tokenomics</a>

          <div
            className="zeus-dropdown-container"
            onMouseEnter={() => setUtilitiesOpen(true)}
            onMouseLeave={() => setUtilitiesOpen(false)}
          >
            <button className="zeus-dropdown-button">UTILITIES</button>
            <div className={`zeus-dropdown-menu ${utilitiesOpen ? 'open' : ''}`}>
              <Link href="/" className="zeus-dropdown-item">
                Hivemind
              </Link>
              <a href="https://pepes.dog/ens" className="zeus-dropdown-item">
                Get ENS
              </a>
              <a href="https://pepes.dog/governance" className="zeus-dropdown-item">
                Governance
              </a>
              <a href="https://pepes.dog/holders" className="zeus-dropdown-item">
                Holders
              </a>
              <a
                href="https://goodboy.pepesdog.box"
                target="_blank"
                rel="noopener noreferrer"
                className="zeus-dropdown-item"
              >
                Goodboy!
              </a>
            </div>
          </div>
        </div>

        <button
          className={`zeus-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className={`zeus-mobile-menu-container ${mobileMenuOpen ? 'open' : ''}`}>
        <a
          href="https://pepes.dog#about"
          className="zeus-mobile-nav-link"
          onClick={() => setMobileMenuOpen(false)}
        >
          About
        </a>
        <a
          href="https://pepes.dog#roadmap"
          className="zeus-mobile-nav-link"
          onClick={() => setMobileMenuOpen(false)}
        >
          Roadmap
        </a>
        <a
          href="https://pepes.dog#tokenomics"
          className="zeus-mobile-nav-link"
          onClick={() => setMobileMenuOpen(false)}
        >
          Tokenomics
        </a>
        <Link
          href="/"
          className="zeus-mobile-nav-link"
          onClick={() => setMobileMenuOpen(false)}
        >
          Hivemind
        </Link>
        <a
          href="https://pepes.dog/ens"
          className="zeus-mobile-nav-link"
          onClick={() => setMobileMenuOpen(false)}
        >
          Get ENS
        </a>
        <a
          href="https://pepes.dog/governance"
          className="zeus-mobile-nav-link"
          onClick={() => setMobileMenuOpen(false)}
        >
          Governance
        </a>
        <a
          href="https://pepes.dog/holders"
          className="zeus-mobile-nav-link"
          onClick={() => setMobileMenuOpen(false)}
        >
          Holders
        </a>
        <a
          href="https://goodboy.pepesdog.box"
          target="_blank"
          rel="noopener noreferrer"
          className="zeus-mobile-nav-link"
          onClick={() => setMobileMenuOpen(false)}
        >
          Goodboy!
        </a>
      </div>
    </nav>
  );
};

export default Navbar;