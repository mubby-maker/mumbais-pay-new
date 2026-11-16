import React, { useState } from 'react';
import { supabase } from './supabase';

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username }
          }
        });

        if (error) throw error;

        if (data.session) {
          onLogin(data.session.user);
        } else {
          setMessage('Account created. Check your email to confirm your account.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;
        onLogin(data.user);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 20,
      background: '#101827'
    }}>
      <form onSubmit={handleSubmit} style={{
        background: 'white',
        padding: 28,
        borderRadius: 18,
        width: '100%',
        maxWidth: 420
      }}>
        <h2 style={{textAlign:'center', color:'#1768e5'}}>
          MUMBAI'S PAY
        </h2>

        <h3 style={{margin:'22px 0'}}>
          {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
        </h3>

        {mode === 'signup' && (
          <input
            required
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={inputStyle}
          />
        )}

        <input
          required
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />

        <input
          required
          type="password"
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button disabled={loading} style={buttonStyle}>
          {loading ? 'Please wait...' :
            mode === 'signup' ? 'Create Account' : 'Login'}
        </button>

        {message && (
          <p style={{marginTop:15, fontSize:14}}>{message}</p>
        )}

        <p style={{textAlign:'center', marginTop:20}}>
          {mode === 'signup' ? 'Already registered?' : 'New here?'}
          {' '}
          <button type="button"
            onClick={() => {
              setMode(mode === 'signup' ? 'login' : 'signup');
              setMessage('');
            }}
            style={{border:0,background:'none',color:'#1768e5'}}>
            {mode === 'signup' ? 'Login' : 'Register'}
          </button>
        </p>
      </form>
    </div>
  );
}

const inputStyle = {
  width:'100%',
  padding:13,
  marginBottom:14,
  border:'1px solid #ddd',
  borderRadius:8
};

const buttonStyle = {
  width:'100%',
  padding:14,
  background:'#1768e5',
  color:'white',
  border:0,
  borderRadius:8,
  fontWeight:'bold'
};
