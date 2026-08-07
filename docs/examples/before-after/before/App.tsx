export default function App() {
  return (
    <div className="page">
      <nav className="navbar">
        <div className="logo">Acme</div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>

      <header className="hero">
        <h1>Welcome to Acme</h1>
        <p>The all-in-one platform for your business needs.</p>
        <button className="cta-button">Get Started</button>
      </header>

      <section className="features">
        <div className="feature-card">
          <div className="icon">⚡</div>
          <h3>Fast</h3>
          <p>Blazing fast performance for every workload.</p>
        </div>
        <div className="feature-card">
          <div className="icon">🔒</div>
          <h3>Secure</h3>
          <p>Enterprise-grade security built in from day one.</p>
        </div>
        <div className="feature-card">
          <div className="icon">📈</div>
          <h3>Scalable</h3>
          <p>Grows with your business, no matter the size.</p>
        </div>
      </section>

      <footer className="footer">
        <p>&copy; 2026 Acme Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
