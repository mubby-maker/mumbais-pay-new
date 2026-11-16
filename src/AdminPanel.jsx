import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

export default function AdminPanel() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [section, setSection] = useState('Members');
  const [records, setRecords] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const tables = {
    Members: 'Profiles',
    Payments: 'membership_payments',
    Withdrawals: 'withdrawal_requests',
    Referrals: 'referral_rewards',
    Cycles: 'daily_reward_cycles',
    Rewards: 'daily_reward_claims'
  };

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
      if (!authData.user) throw new Error('Please log in first.');

      setUser(authData.user);

      const { data, error: roleError } = await supabase
        .from('admin_roles')
        .select('user_id')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (roleError) throw roleError;
      if (!data) throw new Error('Access denied. Admin account required.');

      setIsAdmin(true);
      await Promise.all([
        loadRecords('Members'),
        loadSettings()
      ]);
    } catch (err) {
      setError(err.message || 'Could not verify admin access.');
    } finally {
      setLoading(false);
    }
  }

  async function loadRecords(name) {
    setSection(name);
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { data, error } = await supabase
        .from(tables[name])
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      setRecords([]);
      setError(err.message || 'Could not load records.');
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    const { data, error } = await supabase
      .from('website_settings')
      .select('*');

    if (error) throw error;

    const result = {};
    (data || []).forEach(item => {
      result[item.key] = item.value;
    });

    setSettings(result);
  }

  async function saveSettings() {
    setBusy('settings');
    setError('');
    setMessage('');

    try {
      const entries = [
        ['usdt_trc20_address', settings.usdt_trc20_address || ''],
        ['usdt_bep20_address', settings.usdt_bep20_address || ''],
        ['minimum_withdrawal', settings.minimum_withdrawal || '10.00'],
        ['referral_bonus', settings.referral_bonus || '0.50']
      ];

      for (const [key, value] of entries) {
        const { error } = await supabase
          .from('website_settings')
          .upsert({ key, value }, { onConflict: 'key' });

        if (error) throw error;
      }

      setMessage('Settings saved successfully.');
    } catch (err) {
      setError(err.message || 'Could not save settings.');
    } finally {
      setBusy('');
    }
  }

  async function runAction(label, functionName, args) {
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;

    setBusy(label);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.rpc(functionName, args);
      if (error) throw error;

      setMessage(`${label} completed successfully.`);
      await loadRecords(section);
    } catch (err) {
      setError(err.message || `Could not ${label}.`);
    } finally {
      setBusy('');
    }
  }

  function displayValue(value) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function actionButtons(record) {
    if (record.status !== 'pending') return null;

    if (section === 'Payments') {
      return (
        <div style={styles.actions}>
          <button
            style={styles.approve}
            disabled={!!busy}
            onClick={() =>
              runAction(
                'approve membership',
                'admin_approve_membership',
                { p_payment_id: record.id }
              )
            }
          >
            Approve
          </button>

          <button
            style={styles.reject}
            disabled={!!busy}
            onClick={() =>
              runAction(
                'reject membership',
                'admin_reject_membership',
                { p_payment_id: record.id }
              )
            }
          >
            Reject
          </button>
        </div>
      );
    }

    if (section === 'Withdrawals') {
      return (
        <div style={styles.actions}>
          <button
            style={styles.approve}
            disabled={!!busy}
            onClick={() =>
              runAction(
                'mark withdrawal paid',
                'admin_approve_withdrawal',
                { p_withdrawal_id: record.id }
              )
            }
          >
            Mark Paid
          </button>

          <button
            style={styles.reject}
            disabled={!!busy}
            onClick={() =>
              runAction(
                'reject withdrawal',
                'admin_reject_withdrawal',
                { p_withdrawal_id: record.id }
              )
            }
          >
            Reject
          </button>
        </div>
      );
    }

    return null;
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
        {[
          'Members',
          'Payments',
          'Withdrawals',
          'Referrals',
          'Cycles',
          'Rewards',
          'Settings'
        ].map(name => (
          <button
            key={name}
            onClick={() => {
              if (name === 'Settings') {
                setSection('Settings');
                setError('');
                loadSettings().catch(err => setError(err.message));
              } else {
                loadRecords(name);
              }
            }}
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

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      {section === 'Settings' ? (
        <div style={styles.card}>
          <h2>Website Settings</h2>

          <label style={styles.label}>USDT TRC20 wallet address</label>
          <input
            style={styles.input}
            value={settings.usdt_trc20_address || ''}
            onChange={e =>
              setSettings({
                ...settings,
                usdt_trc20_address: e.target.value
              })
            }
          />

          <label style={styles.label}>USDT BEP20 wallet address</label>
          <input
            style={styles.input}
            value={settings.usdt_bep20_address || ''}
            onChange={e =>
              setSettings({
                ...settings,
                usdt_bep20_address: e.target.value
              })
            }
          />

          <label style={styles.label}>Minimum withdrawal</label>
          <input
            style={styles.input}
            type="number"
            min="0"
            value={settings.minimum_withdrawal || '10.00'}
            onChange={e =>
              setSettings({
                ...settings,
                minimum_withdrawal: e.target.value
              })
            }
          />

          <label style={styles.label}>Referral bonus</label>
          <input
            style={styles.input}
            type="number"
            min="0"
            value={settings.referral_bonus || '0.50'}
            onChange={e =>
              setSettings({
                ...settings,
                referral_bonus: e.target.value
              })
            }
          />

          <button
            style={styles.refresh}
            disabled={!!busy}
            onClick={saveSettings}
          >
            {busy === 'settings' ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      ) : (
        <>
          <h2>{section}</h2>

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
                {actionButtons(record)}
              </div>
            ))
          )}

          <button
            style={styles.refresh}
            disabled={!!busy}
            onClick={() => loadRecords(section)}
          >
            Refresh Records
          </button>
        </>
      )}

      {busy && <p>Processing: {busy}...</p>}
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
  message: { padding: 20 },
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
  label: {
    display: 'block',
    marginTop: 14,
    marginBottom: 5,
    fontWeight: 'bold'
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 12,
    border: '1px solid #ccd3df',
    borderRadius: 8
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12
  },
  approve: {
    background: '#16834a',
    color: 'white',
    border: 0,
    padding: 12,
    borderRadius: 8
  },
  reject: {
    background: '#b42318',
    color: 'white',
    border: 0,
    padding: 12,
    borderRadius: 8
  },
  error: {
    color: '#b00020',
    background: '#ffeaea',
    padding: 12,
    borderRadius: 8
  },
  success: {
    color: '#176b3a',
    background: '#e5f7ec',
    padding: 12,
    borderRadius: 8
  },
  refresh: {
    background: '#1768e5',
    color: 'white',
    border: 0,
    padding: 13,
    borderRadius: 8,
    marginTop: 10
  }
};
