import React, { useEffect, useState } from 'react';
import Auth from './Auth';
import { supabase } from './supabase';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [page, setPage] = useState('Dashboard');
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setError(error.message);
      }

      setUser(data.session?.user ?? null);
      setLoading(false);
    }

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setProfile(null);
      setPlans([]);
    }
  }, [user]);

  async function loadData() {
    setDataLoading(true);
    setError('');

    try {
      const { data: profileData, error: profileError } =
        await supabase
          .from('Profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      setProfile(profileData);

      const { data: planData, error: planError } =
        await supabase
          .from('membership_plans')
          .select('*')
          .eq('is_active', true);

      if (planError) throw planError;

      setPlans(planData || []);
    } catch (err) {
      setError(err.message || 'Could not load your account information.');
    } finally {
      setDataLoading(false);
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
      return;
    }

    setUser(null);
    setProfile(null);
  }

  if (loading) {
    return <div style={styles.center}>Loading Mumbai's Pay...</div>;
  }

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  const balance = Number(profile?.reward_balance || 0);

  const menu = [
    'Dashboard',
    'Membership',
    'Daily Rewards',
    'Referrals',
    'Wallet',
    'Withdrawals',
    'Activities'
  ];

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h2 style={{ margin: 0 }}>MUMBAI'S PAY</h2>
        <p style={{ marginBottom: 12 }}>
          Welcome, {profile?.Username || user.email}
        </p>
        <button onClick={logout} style={styles.logout}>
          Logout
        </button>
      </header>

      <nav style={styles.nav}>
        {menu.map(item => (
          <button
            key={item}
            onClick={() => setPage(item)}
            style={{
              ...styles.navButton,
              background: page === item ? '#1768e5' : '#edf1f7',
              color: page === item ? '#ffffff' : '#26344a'
            }}
          >
            {item}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {dataLoading && (
          <p>Loading your account information...</p>
        )}

        {page === 'Dashboard' && (
          <>
            <h2>Dashboard</h2>

            <div style={styles.card}>
              <p style={styles.label}>Available Reward Balance</p>
              <h1 style={styles.amount}>
                ${balance.toFixed(2)}
              </h1>
            </div>

            <div style={styles.card}>
              <p style={styles.label}>Membership Plan</p>
              <h3>
                {profile?.Membership_plan || 'No active plan'}
              </h3>
              <p>
                Status: {profile?.Membership_status || 'Not active'}
              </p>
            </div>

            <div style={styles.card}>
              <p style={styles.label}>Referral Code</p>
              <h3>
                {profile?.Referral_code || 'Not available'}
              </h3>
            </div>

            <button onClick={loadData} style={styles.primaryButton}>
              Refresh Dashboard
            </button>
          </>
        )}

        {page === 'Membership' && (
          <>
            <h2>Membership Plans</h2>

            {plans.length === 0 && !dataLoading && (
              <div style={styles.card}>
                No active membership plans found.
              </div>
            )}

            {plans.map(plan => (
              <div style={styles.card} key={plan.id}>
                <h3>{plan.name}</h3>
                <p>
                  Registration Fee: ${plan.registration_fee}
                </p>
                <p>
                  Daily Reward: ${plan.daily_reward}
                </p>
                <p>
                  Duration: {plan.duration_days} days
                </p>
                <button
                  style={styles.primaryButton}
                  onClick={() => {
                    alert('Membership payment is not connected yet.');
                  }}
                >
                  Select Plan
                </button>
              </div>
            ))}
          </>
        )}

        {page !== 'Dashboard' && page !== 'Membership' && (
          <>
            <h2>{page}</h2>
            <div style={styles.card}>
              <p>This section is not connected yet.</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    background: '#f4f6fb',
    fontFamily: 'Arial, sans-serif',
    color: '#172033'
  },
  center: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    background: '#101827',
    color: '#ffffff',
    padding: 22
  },
  logout: {
    padding: '10px 18px',
    border: 0,
    borderRadius: 7,
    cursor: 'pointer'
  },
  nav: {
    display: 'flex',
    gap: 8,
    padding: 12,
    overflowX: 'auto',
    background: '#ffffff'
  },
  navButton: {
    padding: 11,
    border: 0,
    borderRadius: 8,
    whiteSpace: 'nowrap',
    cursor: 'pointer'
  },
  main: {
    padding: 18,
    maxWidth: 850,
    margin: '0 auto'
  },
  card: {
    background: '#ffffff',
    padding: 20,
    borderRadius: 13,
    marginTop: 15,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  label: {
    color: '#64748b',
    marginBottom: 8
  },
  amount: {
    color: '#1768e5',
    fontSize: 32,
    margin: 0
  },
  primaryButton: {
    background: '#1768e5',
    color: '#ffffff',
    padding: '12px 18px',
    border: 0,
    borderRadius: 8,
    marginTop: 10,
    cursor: 'pointer'
  },
  error: {
    color: '#a40000',
    background: '#ffeaea',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15
  }
};
