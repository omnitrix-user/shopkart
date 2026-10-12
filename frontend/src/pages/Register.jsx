import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import FormField from '../components/FormField.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import { registerCustomer } from '../services/api.js';
import { PASSWORD_MIN_LENGTH, validateRegistration } from '../utils/validation.js';

const EMPTY_FORM = { fullName: '', email: '', password: '', phone: '' };

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setFormError('');
    const validationErrors = validateRegistration(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const { customer } = await registerCustomer({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
      });
      navigate('/login', {
        replace: true,
        state: {
          email: customer.email,
          notice: { tone: 'success', text: 'Account created successfully. Please log in to continue.' },
        },
      });
    } catch (error) {
      setErrors(error.fieldErrors || {});
      setFormError(error.message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join ShopKart in less than a minute."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form className="form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
        <Alert tone="error">{formError}</Alert>

        <FormField
          label="Full name"
          name="fullName"
          autoComplete="name"
          placeholder="John Doe"
          value={form.fullName}
          onChange={handleChange}
          error={errors.fullName}
          maxLength={80}
          required
          disabled={submitting}
        />
        <FormField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
          maxLength={254}
          required
          disabled={submitting}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          required
          disabled={submitting}
        />
        <FormField
          label="Phone number"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="9876543210"
          hint="10 to 15 digits; you may start with +country code."
          value={form.phone}
          onChange={handleChange}
          error={errors.phone}
          maxLength={20}
          required
          disabled={submitting}
        />

        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting && <Spinner />}
          {submitting ? 'Creating account…' : 'Create Account'}
        </button>
      </form>
    </AuthLayout>
  );
}
