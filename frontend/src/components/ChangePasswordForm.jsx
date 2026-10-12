import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { changePassword } from '../services/api.js';
import { PASSWORD_MIN_LENGTH, validatePasswordChange } from '../utils/validation.js';
import FormField from './FormField.jsx';
import Alert from './Alert.jsx';
import Spinner from './Spinner.jsx';

const EMPTY_FORM = { oldPassword: '', newPassword: '', confirmPassword: '' };

export default function ChangePasswordForm() {
  const { markSignedOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  };

  const close = () => {
    setOpen(false);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setMessage(null);
    const validationErrors = validatePasswordChange(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await changePassword({ oldPassword: form.oldPassword, newPassword: form.newPassword });
      close();
      setMessage({ tone: 'success', text: result.message });
    } catch (error) {
      if (error.isUnauthorized) {
        markSignedOut('session');
        return;
      }
      setErrors(error.fieldErrors || {});
      setMessage({ tone: 'error', text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card info-card" aria-labelledby="security-title">
      <h2 id="security-title" className="card__title">
        Password &amp; security
      </h2>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {!open ? (
        <>
          <p className="muted">Changing your password signs you out on every other device.</p>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => {
              setMessage(null);
              setOpen(true);
            }}
          >
            Change password
          </button>
        </>
      ) : (
        <form className="form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <FormField
            label="Current password"
            name="oldPassword"
            type="password"
            autoComplete="current-password"
            value={form.oldPassword}
            onChange={handleChange}
            error={errors.oldPassword}
            disabled={submitting}
            required
          />
          <FormField
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            value={form.newPassword}
            onChange={handleChange}
            error={errors.newPassword}
            disabled={submitting}
            required
          />
          <FormField
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            disabled={submitting}
            required
          />
          <div className="form__actions">
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting && <Spinner />}
              {submitting ? 'Updating…' : 'Update password'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={close} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
