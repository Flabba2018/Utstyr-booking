// =============================================================================
// LoginPage: Innlogging med e-post og passord
// =============================================================================

import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      if (isRegister) {
        if (!fullName) {
          showToast('Fyll inn navn', 'error');
          return;
        }
        await signUp(email, password, fullName);
        showToast('Registrering vellykket! Sjekk e-posten din for bekreftelse.', 'success');
      } else {
        await signIn(email, password);
        showToast('Logget inn!', 'success');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Noe gikk galt';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>⚙️ Utstyrsbooking</h1>
        <p>{isRegister ? 'Opprett ny konto' : 'Logg inn for å fortsette'}</p>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Fullt navn</label>
              <input
                className="form-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ola Nordmann"
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">E-post</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din@epost.no"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Passord</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading
              ? 'Vennligst vent...'
              : isRegister
              ? 'Registrer'
              : 'Logg inn'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister
              ? 'Har du allerede en konto? Logg inn'
              : 'Ny bruker? Registrer deg'}
          </button>
        </div>
      </div>
    </div>
  );
}
