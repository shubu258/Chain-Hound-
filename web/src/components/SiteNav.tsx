export function SiteNav() {
  return (
    <header className="site-nav">
      <div className="nav-inner">
        <a href="#investigate" className="brand">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="12" stroke="#F2ECDC" strokeWidth="1.4" />
            <circle cx="13" cy="13" r="4" stroke="#F2ECDC" strokeWidth="1.4" />
            <line x1="21" y1="21" x2="25" y2="25" stroke="#F2ECDC" strokeWidth="1.6" strokeLinecap="round" />
            <circle className="paw-dot" cx="13" cy="13" r="1.6" />
          </svg>
          ChainHound
        </a>
        <nav className="nav-links">
          <a href="#investigate" className="active">
            Investigate
          </a>
          <a href="#live-status">Live workflow</a>
          <a href="#pipeline">How it works</a>
        </nav>
      </div>
    </header>
  );
}
