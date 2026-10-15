import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useWishlistSnapshot } from '../hooks/useWishlist.js';
import Logo from './Logo.jsx';
import Spinner from './Spinner.jsx';

const initialsOf = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

const navClass = ({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`;

function Count({ value, label }) {
  return (
    <span className="nav-count" aria-label={`${value} ${label}`}>
      ({value})
    </span>
  );
}

export default function Navbar() {
  const { status, customer, signOut } = useAuth();
  const { cartCount } = useCart();
  const wishlist = useWishlistSnapshot();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const isAuthenticated = status === 'authenticated' && customer;

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await signOut();
      navigate('/login', {
        replace: true,
        state: { notice: { tone: 'success', text: 'You have been logged out successfully.' } },
      });
    } catch (error) {
      setLogoutError(`Logout failed: ${error.message}`);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/products" className="navbar__brand" aria-label="ShopKart home">
          <Logo />
        </Link>

        <nav className="navbar__links" aria-label="Main navigation">
          {isAuthenticated && (
            <NavLink to="/home" className={navClass}>
              Home
            </NavLink>
          )}
          <NavLink to="/products" className={navClass}>
            Products
          </NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/wishlist" className={navClass}>
                Wishlist <Count value={wishlist ? wishlist.length : 0} label="saved products" />
              </NavLink>
              <NavLink to="/cart" className={navClass}>
                Cart <Count value={cartCount} label="items in cart" />
              </NavLink>
              <NavLink to="/orders" className={navClass}>
                Orders
              </NavLink>
            </>
          )}
        </nav>

        <div className="navbar__account">
          {isAuthenticated ? (
            <>
              <Link to="/home" className="navbar__user" title={customer.email}>
                <span className="avatar avatar--sm" aria-hidden="true">
                  {initialsOf(customer.fullName)}
                </span>
                <span className="navbar__user-name">{customer.fullName.split(' ')[0]}</span>
              </Link>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-busy={loggingOut}
              >
                {loggingOut && <Spinner />}
                {loggingOut ? 'Logging out…' : 'Logout'}
              </button>
            </>
          ) : (
            status === 'unauthenticated' && (
              <>
                <NavLink to="/login" className={navClass}>
                  Log in
                </NavLink>
                <NavLink to="/register" className="btn btn--primary btn--sm">
                  Create account
                </NavLink>
              </>
            )
          )}
        </div>
      </div>
      {logoutError && (
        <div className="navbar__error" role="alert">
          <div className="container">
            {logoutError}
            <button type="button" className="link-button" onClick={() => setLogoutError('')}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
