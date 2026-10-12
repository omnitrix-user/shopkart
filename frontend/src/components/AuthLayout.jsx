import shoppingIllustration from '../assets/shopping-illustration.svg';

const HIGHLIGHTS = [
  'Passwords are hashed with bcrypt — never stored as plain text',
  'Your session lives in a secure, HttpOnly cookie',
  'Your profile is always one click away',
];

/** Two-column shell for the login and registration pages. */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-layout container">
      <aside className="auth-aside" aria-label="About ShopKart accounts">
        <p className="auth-aside__eyebrow">ShopKart customer account</p>
        <h2 className="auth-aside__title">Everything you love, in one cart.</h2>
        <img className="auth-aside__art" src={shoppingIllustration} alt="" width="320" height="260" />
        <ul className="auth-aside__list">
          {HIGHLIGHTS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </aside>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="card auth-card">
          <header className="auth-card__header">
            <h1 id="auth-title" className="auth-card__title">
              {title}
            </h1>
            <p className="auth-card__subtitle">{subtitle}</p>
          </header>
          {children}
        </div>
        {footer && <p className="auth-panel__footer">{footer}</p>}
      </section>
    </div>
  );
}
