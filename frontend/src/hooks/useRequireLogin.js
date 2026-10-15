import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Returns a guard for shopper actions: true when logged in, otherwise sends the visitor
 * to the login page (and back here afterwards) and returns false.
 */
export function useRequireLogin() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (message = 'Please log in to continue.') => {
      if (status === 'authenticated') return true;
      navigate('/login', {
        state: { from: `${location.pathname}${location.search}`, notice: { tone: 'info', text: message } },
      });
      return false;
    },
    [status, navigate, location.pathname, location.search],
  );
}
