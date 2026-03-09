'use client';

import React from 'react';
import Link from 'next/link';
import './navbar.css';

const Navbar: React.FC = () => {
  return (
    <nav className="zeus-navbar">
      <div className="zeus-navbar-container">
        <Link href="/admin" className="zeus-navbar-logo">
          <span className="zeus-navbar-logo-text">
            X Agentic API
          </span>
        </Link>

        <div className="zeus-navbar-links">
          <Link href="/dashboard" className="zeus-navbar-link">Dashboard</Link>
          <Link href="/admin" className="zeus-navbar-link">Admin</Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
