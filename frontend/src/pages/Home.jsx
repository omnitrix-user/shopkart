import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ChangePasswordForm from '../components/ChangePasswordForm.jsx';

const greetingFor = (date) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatDate = (value) =>
  new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));

const initialsOf = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

function DetailIcon({ children }) {
  return (
    <svg className="detail__icon" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Protected page — rendered only after GET /customers/me has confirmed the session. */
export default function Home() {
  const { customer } = useAuth();
  const firstName = customer.fullName.split(' ')[0];

  return (
    <div className="container home">
      <section className="home-hero" aria-labelledby="home-title">
        <div>
          <p className="home-hero__eyebrow">{greetingFor(new Date())}</p>
          <h1 id="home-title" className="home-hero__title">
            Welcome back, {firstName}!
          </h1>
          <p className="home-hero__subtitle">
            You’re signed in to ShopKart. Here are the details on your customer account.
          </p>
        </div>
        <span className="badge badge--success">
          <span className="badge__dot" aria-hidden="true" />
          Signed in
        </span>
      </section>

      <div className="home-grid">
        <section className="card profile-card" aria-labelledby="profile-title">
          <div className="profile-card__head">
            <span className="avatar avatar--lg" aria-hidden="true">
              {initialsOf(customer.fullName)}
            </span>
            <div>
              <h2 id="profile-title" className="profile-card__name">
                {customer.fullName}
              </h2>
              <p className="muted">ShopKart customer since {formatDate(customer.createdAt)}</p>
            </div>
          </div>

          <dl className="details">
            <div className="detail">
              <DetailIcon>
                <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
              </DetailIcon>
              <dt>Full name</dt>
              <dd>{customer.fullName}</dd>
            </div>
            <div className="detail">
              <DetailIcon>
                <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5ZM3.5 6l8.5 7 8.5-7" />
              </DetailIcon>
              <dt>Email</dt>
              <dd>{customer.email}</dd>
            </div>
            <div className="detail">
              <DetailIcon>
                <path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2" />
              </DetailIcon>
              <dt>Phone number</dt>
              <dd>{customer.phone}</dd>
            </div>
            <div className="detail">
              <DetailIcon>
                <path d="M4 7h16M4 7v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7M4 7l1.5-3h13L20 7M8 3v4M16 3v4" />
              </DetailIcon>
              <dt>Member since</dt>
              <dd>{formatDate(customer.createdAt)}</dd>
            </div>
          </dl>
        </section>

        <aside className="home-side">
          <section className="card info-card" aria-labelledby="shop-title">
            <h2 id="shop-title" className="card__title">
              Shop
            </h2>
            <div className="quick-links">
              <Link to="/products" className="btn btn--primary btn--sm">
                Browse products
              </Link>
              <Link to="/wishlist" className="btn btn--outline btn--sm">
                My wishlist
              </Link>
              <Link to="/cart" className="btn btn--outline btn--sm">
                My cart
              </Link>
              <Link to="/orders" className="btn btn--outline btn--sm">
                My orders
              </Link>
            </div>
          </section>
          <section className="card info-card" aria-labelledby="session-title">
            <h2 id="session-title" className="card__title">
              Your session
            </h2>
            <p className="muted">
              You’re signed in with a secure, HttpOnly cookie that expires automatically. Use{' '}
              <strong>Log out</strong> in the top bar when you’re done, especially on a shared device.
            </p>
          </section>

          <ChangePasswordForm />
        </aside>
      </div>
    </div>
  );
}
