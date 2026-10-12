import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
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

export default function Navbar() {
  const { status, customer, signOut } = useAuth();
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
        <Link to={isAuthenticated ? '/home' : '/login'} className="navbar__brand" aria-label="ShopKart home">
          <Logo />
        </Link>

        <nav className="navbar__nav" aria-label="Main navigation">
          {isAuthenticated ? (
            <>
              <NavLink to="/home" className={navClass}>
                My account
              </NavLink>
              <span className="navbar__user" title={customer.email}>
                <span className="avatar avatar--sm" aria-hidden="true">
                  {initialsOf(customer.fullName)}
                </span>
                <span className="navbar__user-name">{customer.fullName.split(' ')[0]}</span>
              </span>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-busy={loggingOut}
              >
                {loggingOut && <Spinner />}
                {loggingOut ? 'Logging out…' : 'Log out'}
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
        </nav>
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
