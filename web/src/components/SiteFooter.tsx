export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href="#" className="brand">
              <svg width="24" height="24" viewBox="0 0 26 26" fill="none">
                <circle cx="13" cy="13" r="12" stroke="#F2ECDC" strokeWidth="1.4" />
                <circle cx="13" cy="13" r="4" stroke="#F2ECDC" strokeWidth="1.4" />
                <line x1="21" y1="21" x2="25" y2="25" stroke="#F2ECDC" strokeWidth="1.6" strokeLinecap="round" />
                <circle className="paw-dot" cx="13" cy="13" r="1.6" fill="#C15A28" />
              </svg>
              ChainHound
            </a>
            <p>An investigation engine for onchain funds — built on live blockchain data, not guesswork.</p>
          </div>
          <div className="footer-col">
            <h5>PRODUCT</h5>
            <a href="#investigate">Wallet analysis</a>
            <a href="#investigate">Fund tracing</a>
          </div>
          <div className="footer-col">
            <h5>DEVELOPERS</h5>
            <a href="https://github.com/shubu258/Chain-Hound-">Repository</a>
            <a href="/docs">Agent API docs</a>
            <a href="/openapi/chainhound.json">OpenAPI spec</a>
          </div>
          <div className="footer-col">
            <h5>COMPANY</h5>
            <a href="#pipeline">How it works</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 ChainHound. Built for ETHOnline 2026.</span>
          <div className="socials">
            <a href="https://github.com/shubu258/Chain-Hound-">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
