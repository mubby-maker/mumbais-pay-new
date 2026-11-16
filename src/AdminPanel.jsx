import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

const TABLES = {
  Members: 'Profiles',
  Payments: 'membership_payments',
  Withdrawals: 'withdrawal_requests',
  Referrals: 'referral_rewards',
  Cycles: 'daily_reward_cycles',
  Rewards: 'daily_reward_claims'
};

const money = value => `$${Number(value || 0).toFixed(2)}`;

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

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    setLoading(true);
    setError('');

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!auth.user) throw new Error('Please log in first.');

      setUser(auth.user);

      const { data: role, error: roleError } = await supabase
        .from('admin_roles')
        .select('user_id')
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (roleError) throw roleError;
      if (!role) throw new Error('Admin account required.');

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

  async function loadRecords(name = section) {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { data, error } = await supabase
        .from(TABLES[name])
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRecords(data || []);
      setSection(name);
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

    const next = {};

    (data || []).forEach(item => {
      next[item.key] = item.value;
    });

    setSettings(next);
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

      setMessage('Website settings saved successfully.');
    } catch (err) {
      setError(err.message || 'Could not save settings.');
    } finally {
      setBusy('');
    }
  }

  async function runAction(label, rpc, args) {
    if (!window.confirm(`Are you sure you want to ${label}?`)) {
      return;
    }

    setBusy(label);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.rpc(rpc, args);

      if (error) throw error;

      setMessage(`${label} completed successfully.`);

      await loadRecords(section);
    } catch (err) {
      setError(err.message || `Could not ${label}.`);
    } finally {
      setBusy('');
    }
  }

  function renderActions(record) {
    if (record.status !== 'pending') {
      return null;
    }

    if (section === 'Payments') {
      return (
        <div style={a.actions}>
          <button
            style={a.approve}
            disabled={!!busy}
            onClick={() =>
              runAction(
                'approve membership',
                'admin_approve_membership',
                { p_payment_id: record.id }
              )
            }
          >
            Approve payment
          </button>

          <button
            style={a.reject}
            disabled={!!busy}
            onClick={() =>
              runAction(
                'reject membership',
                'admin_reject_membership',
                { p_payment_id: record.id }
              )
            }
          >
            Reject payment
          </button>
        </div>
      );
    }

    if (section === 'Withdrawals') {
      return (
        <div style={a.actions}>
          <button
            style={a.approve}
            disabled={!!busy}
            onClick={() =>
              runAction(
                'mark withdrawal paid',
                'admin_approve_withdrawal',
                { p_withdrawal_id: record.id }
              )
            }
          >
            Mark as paid
          </button>

          <button
            style={a.reject}
            disabled={!!busy}
            onClick={() =>
              runAction(
                'reject withdrawal',
                'admin_reject_withdrawal',
                { p_withdrawal_id: record.id }
              )
            }
          >
            Reject withdrawal
          </button>
        </div>
      );
    }

    return null;
  }

  if (loading && !isAdmin) {
    return <p style={a.message}>Checking admin access…</p>;
  }

  if (!isAdmin) {
    return (
      <div style={a.container}>
        <h2>Admin access</h2>
        <p style={a.error}>
          {error || 'Access denied. Admin account required.'}
        </p>
      </div>
    );
  }

  return (
    <div style={a.container}>
      <h1>Mumbai’s Pay Admin</h1>

      <p>Administrator: {user?.email}</p>

      <div style={a.menu}>
        {[...Object.keys(TABLES), 'Settings'].map(name => (
          <button
            key={name}
            onClick={() => {
              if (name === 'Settings') {
                setSection('Settings');
                setError('');
                setMessage('');
                loadSettings().catch(err =>
                  setError(err.message)
                );
              } else {
                loadRecords(name);
              }
            }}
            style={{
              ...a.tab,
              ...(section === name ? a.activeTab : {})
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {error && <p style={a.error}>{error}</p>}
      {message && <p style={a.success}>{message}</p>}

      {section === 'Settings' ? (
        <div style={a.card}>
          <h2>Website settings</h2>

          <label style={a.label}>
            USDT TRC20 wallet address
          </label>

          <input
            style={a.input}
            value={settings.usdt_trc20_address || ''}
            onChange={e =>
              setSettings({
                ...settings,
                usdt_trc20_address: e.target.value
              })
            }
            placeholder="Enter TRC20 wallet address"
          />

          <label style={a.label}>
            USDT BEP20 wallet address
          </label>

          <input
            style={a.input}
            value={settings.usdt_bep20_address || ''}
            onChange={e =>
              setSettings({
                ...settings,
                usdt_bep20_address: e.target.value
              })
            }
            placeholder="Enter BEP20 wallet address"
          />

          <label style={a.label}>
            Minimum withdrawal (USD)
          </label>

          <input
            style={a.input}
            type="number"
            min="0"
            step="0.01"
            value={settings.minimum_withdrawal || '10.00'}
            onChange={e =>
              setSettings({
                ...settings,
                minimum_withdrawal: e.target.value
              })
            }
          />

          <label style={a.label}>
            Referral bonus (USD)
          </label>

          <input
            style={a.input}
            type="number"
            min="0"
            step="0.01"
            value={settings.referral_bonus || '0.50'}
            onChange={e =>
              setSettings({
                ...settings,
                referral_bonus: e.target.value
              })
            }
          />

          <button
            style={a.refresh}
            disabled={!!busy}
            onClick={saveSettings}
          >
            {busy === 'settings' ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      ) : (
        <>
          <h2>{section}</h2>

          {loading ? (
            <p>Loading records…</p>
          ) : records.length === 0 ? (
            <p>No records found.</p>
          ) : (
            records.map((record, index) => (
              <div
                style={a.card}
                key={record.id || index}
              >
                {Object.entries(record).map(([key, value]) => (
                  <p key={key} style={a.row}>
                    <strong>
                      {key.replaceAll('_', ' ')}:
                    </strong>

                    <span>
                      {value === null || value === undefined
                        ? '-'
                        : typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)}
                    </span>
                  </p>
                ))}

                {renderActions(record)}
              </div>
            ))
          )}

          <button
            style={a.refresh}
            disabled={!!busy}
            onClick={() => loadRecords(section)}
          >
            Refresh records
          </button>
        </>
      )}

      {busy && <p>Processing: {busy}…</p>}
    </div>
  );
}

const a = {
  container: {
    padding: 18,
    maxWidth: 850,
    margin: '0 auto',
    fontFamily: 'Arial,sans-serif',
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

  tab: {
    border: 0,
    padding: 12,
    borderRadius: 8,
    background: '#e8edf5',
    color: '#172033'
  },

  activeTab: {
    background: '#1768e5',
    color: 'white'
  },

  card: {
    background: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    boxShadow: '0 2px 6px rgba(0,0,0,.08)'
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
