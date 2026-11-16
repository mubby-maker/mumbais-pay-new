import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

export default function AdminPanel() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [section, setSection] = useState('Members');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData.user) {
        setError('Please log in first.');
        setLoading(false);
        return;
      }

      setUser(authData.user);

      const { data, error: roleError } = await supabase
        .from('admin_roles')
        .select('*')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      if (!data) {
        setError('Access denied. Admin account required.');
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      await loadRecords('Members');
    } catch (err) {
      setError(err.message || 'Could not verify admin access.');
    }

    setLoading(false);
  }

  async function loadRecords(name) {
    setSection(name);
    setLoading(true);
    setError('');

    const tables = {
      Members: 'Profiles',
      Payments: 'membership_payments',
      Withdrawals: 'withdrawal_requests',
      Referrals: 'referral_rewards'
    };

    try {
      const { data, error } = await supabase
        .from(tables[name])
        .select('*');

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      setRecords([]);
      setError(err.message || 'Could not load records.');
    }

    setLoading(false);
  }

  function displayValue(value) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  if (loading && !isAdmin) {
    return <p style={styles.message}>Checking admin access...</p>;
  }

  if (!isAdmin) {
    return (
      <div style={styles.container}>
        <h2>Admin Access</h2>
        <p style={styles.error}>{error || 'Access denied.'}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1>Mumbai's Pay Admin</h1>
      <p>Administrator: {user?.email}</p>

      <div style={styles.menu}>
        {['Members', 'Payments', 'Withdrawals', 'Referrals'].map(name => (
          <button
            key={name}
            onClick={() => loadRecords(name)}
            style={{
              ...styles.button,
              background: section === name ? '#1768e5' : '#e8edf5',
              color: section === name ? 'white' : '#172033'
            }}
          >
            {name}
          </button>
        ))}
      </div>

      <h2>{section}</h2>

      {error && <p style={styles.error}>{error}</p>}

      {loading ? (
        <p>Loading records...</p>
      ) : records.length === 0 ? (
        <p>No records found.</p>
      ) : (
        records.map((record, index) => (
          <div style={styles.card} key={record.id || index}>
            {Object.entries(record).map(([key, value]) => (
              <p key={key} style={styles.row}>
                <strong>{key.replaceAll('_', ' ')}:</strong>
                <span>{displayValue(value)}</span>
              </p>
            ))}
          </div>
        ))
      )}

      <button
        style={styles.refresh}
        onClick={() => loadRecords(section)}
      >
        Refresh Records
      </button>
    </div>
  );
}

const styles = {
  container: {
    padding: 18,
    maxWidth: 850,
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
    color: '#172033'
  },
  message: {
    padding: 20
  },
  menu: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    margin: '20px 0'
  },
  button: {
    border: 0,
    padding: 12,
    borderRadius: 8
  },
  card: {
    background: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    overflowWrap: 'anywhere',
    borderBottom: '1px solid #eee',
    paddingBottom: 8
  },
  error: {
    color: '#b00020',
    background: '#ffeaea',
    padding: 12,
    borderRadius: 8
  },
  refresh: {
    background: '#1768e5',
    color: 'white',
    border: 0,
    padding: 13,
    borderRadius: 8
  }
};
