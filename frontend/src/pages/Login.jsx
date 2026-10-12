import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import FormField from '../components/FormField.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import { loginCustomer } from '../services/api.js';
import { validateLogin } from '../utils/validation.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.notice;

  const [form, setForm] = useState({ email: location.state?.email || '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [noticeVisible, setNoticeVisible] = useState(Boolean(notice));

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setFormError('');
    setNoticeVisible(false);
    const validationErrors = validateLogin(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await loginCustomer({ email: form.email.trim(), password: form.password });
      navigate('/home', { replace: true });
    } catch (error) {
      if (error.isUnauthorized) {
        setFormError('Invalid Credentials');
        setForm((current) => ({ ...current, password: '' }));
      } else {
        setErrors(error.fieldErrors || {});
        setFormError(error.message);
      }
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your ShopKart account."
      footer={
        <>
          New to ShopKart? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
        {noticeVisible && <Alert tone={notice.tone}>{notice.text}</Alert>}
        <Alert tone="error">{formError}</Alert>

        <FormField
          label="Email address"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
          required
          disabled={submitting}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          required
          disabled={submitting}
        />

        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting && <Spinner />}
          {submitting ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </AuthLayout>
  );
}
