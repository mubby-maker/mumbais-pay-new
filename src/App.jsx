import React, { useEffect, useState } from 'react';
import Auth from './Auth';
import AdminPanel from './AdminPanel';
import { supabase } from './supabase';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [activities, setActivities] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [page, setPage] = useState('Dashboard');
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) setError(error.message);
      setUser(data.session?.user ?? null);
      setLoading(false);
    }

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) loadData();
    else {
      setProfile(null);
      setPlans([]);
      setRewards([]);
      setReferrals([]);
      setActivities([]);
      setCompletions([]);
    }
  }, [user]);

  async function loadData() {
    if (!user) return;

    setDataLoading(true);
    setError('');

    try {
      const { data: profileData, error: profileError } =
        await supabase.from('Profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: planData, error: planError } =
        await supabase.from('membership_plans')
          .select('*')
          .eq('is_active', true);

      if (planError) throw planError;
      setPlans(planData || []);

      const { data: rewardData, error: rewardError } =
        await supabase.from('reward_ledger')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

      if (rewardError) throw rewardError;
      setRewards(rewardData || []);

      const { data: referralData, error: referralError } =
        await supabase.from('referral_rewards')
          .select('*')
          .eq('referrer_user_id', user.id)
          .order('created_at', { ascending: false });

      if (referralError) throw referralError;
      setReferrals(referralData || []);

      const { data: activityData, error: activityError } =
        await supabase.from('activities')
          .select('*')
          .eq('is_actice', true)
          .order('created_at', { ascending: false });

      if (activityError) throw activityError;
      setActivities(activityData || []);

      const { data: completionData, error: completionError } =
        await supabase.from('activity_completions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

      if (completionError) throw completionError;
      setCompletions(completionData || []);
    } catch (err) {
      setError(err.message || 'Could not load account information.');
    } finally {
      setDataLoading(false);
    }
  }

  async function submitActivity(activityId) {
    const alreadySubmitted = completions.some(
      item =>
        item.activity_id === activityId &&
        (item.status === 'pending' || item.status === 'approved')
    );

    if (alreadySubmitted) {
      alert('You have already submitted this activity.');
      return;
    }

    const { error } = await supabase
      .from('activity_completions')
      .insert({
        user_id: user.id,
        activity_id: activityId,
        status: 'pending'
      });

    if (error) {
      alert('Could not submit activity: ' + error.message);
      return;
    }

    alert('Activity submitted. It is waiting for admin approval.');
    await loadData();
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      return;
    }
    setUser(null);
    setProfile(null);
    setPage('Dashboard');
  }

  async function copyReferralCode() {
    const code = profile?.Referral_code;
    if (!code) {
      alert('Your referral code is not available yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      alert('Referral code copied!');
    } catch {
      alert('Copy this code manually: ' + code);
    }
  }

  if (loading) {
    return <div style={styles.center}>Loading Mumbai's Pay...</div>;
  }

  if (!user) return <Auth onLogin={setUser} />;

  const balance = Number(profile?.reward_balance || 0);
  const referralTotal = referrals.reduce(
    (total, item) => total + Number(item.amount || 0), 0
  );

  const menu = [
    'Dashboard',
    'Membership',
    'Daily Rewards',
    'Referrals',
    'Wallet',
    'Withdrawals',
    'Activities',
    'Admin'
  ];

  function activityStatus(activityId) {
    return completions.find(
      item =>
        item.activity_id === activityId &&
        (item.status === 'pending' || item.status === 'approved')
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h2>MUMBAI'S PAY</h2>
        <p>Welcome, {profile?.Username || user.email}</p>
        <button onClick={logout} style={styles.logout}>Logout</button>
      </header>

      <nav style={styles.nav}>
        {menu.map(item => (
          <button
            key={item}
            onClick={() => setPage(item)}
            style={{
              ...styles.navButton,
              background: page === item ? '#1768e5' : '#edf1f7',
              color: page === item ? 'white' : '#26344a'
            }}
          >
            {item}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {error && <div style={styles.error}>{error}</div>}

        {dataLoading && page !== 'Admin' && (
          <p>Loading account information...</p>
        )}

        {page === 'Dashboard' && (
          <>
            <h2>Dashboard</h2>
            <div style={styles.card}>
              <p>Available Reward Balance</p>
              <h1 style={styles.amount}>${balance.toFixed(2)}</h1>
            </div>
            <div style={styles.card}>
              <p>Membership Plan</p>
              <h3>{profile?.Membership_plan || 'No active plan'}</h3>
              <p>Status: {profile?.Membership_status || 'Not active'}</p>
            </div>
            <div style={styles.card}>
              <p>Referral Code</p>
              <h3>{profile?.Referral_code || 'Not available'}</h3>
            </div>
            <button onClick={loadData} style={styles.button}>
              Refresh Dashboard
            </button>
          </>
        )}

        {page === 'Membership' && (
          <>
            <h2>Membership Plans</h2>
            {plans.length === 0 && !dataLoading && (
              <div style={styles.card}>No active plans found.</div>
            )}
            {plans.map(plan => (
              <div style={styles.card} key={plan.id}>
                <h3>{plan.name}</h3>
                <p>Registration Fee: ${plan.registration_fee}</p>
                <p>Daily Reward: ${plan.daily_reward}</p>
                <p>Duration: {plan.duration_days} days</p>
                <button
                  style={styles.button}
                  onClick={() => alert('Membership payment is not connected yet.')}
                >
                  Select Plan
                </button>
              </div>
            ))}
          </>
        )}

        {page === 'Daily Rewards' && (
          <>
            <h2>Daily Rewards</h2>
            <div style={styles.card}>
              <p>Current Reward Balance</p>
              <h1 style={styles.amount}>${balance.toFixed(2)}</h1>
              <p>Eligible rewards are recorded in your account.</p>
            </div>
            <div style={styles.card}>
              <h3>Reward History</h3>
              {rewards.length === 0 ? (
                <p>No reward transactions recorded yet.</p>
              ) : rewards.map((reward, index) => (
                <div key={reward.id || index} style={styles.row}>
                  <div>
                    <strong>{reward.description || 'Reward credit'}</strong>
                    <p style={styles.date}>
                      {reward.created_at
                        ? new Date(reward.created_at).toLocaleString()
                        : ''}
                    </p>
                  </div>
                  <strong>${Number(reward.amount || 0).toFixed(2)}</strong>
                </div>
              ))}
            </div>
            <button onClick={loadData} style={styles.button}>
              Refresh Rewards
            </button>
          </>
        )}

        {page === 'Referrals' && (
          <>
            <h2>My Referrals</h2>
            <div style={styles.card}>
              <p>Your Referral Code</p>
              <h2>{profile?.Referral_code || 'Not available'}</h2>
              <button onClick={copyReferralCode} style={styles.button}>
                Copy Referral Code
              </button>
            </div>
            <div style={styles.card}>
              <h3>Referral Earnings</h3>
              <h2 style={styles.amount}>${referralTotal.toFixed(2)}</h2>
              <p>Referral rewards are subject to verification.</p>
            </div>
            <div style={styles.card}>
              <h3>Eligible Referrals: {referrals.length}</h3>
              {referrals.map(item => (
                <div key={item.id} style={styles.row}>
                  <span>{item.referred_user_id}</span>
                  <strong>${Number(item.amount || 0).toFixed(2)}</strong>
                </div>
              ))}
            </div>
          </>
        )}

        {page === 'Wallet' && (
          <>
            <h2>My Wallet</h2>
            <div style={styles.card}>
              <p>Available Balance</p>
              <h1 style={styles.amount}>${balance.toFixed(2)}</h1>
              <p>Your recorded reward balance.</p>
            </div>
            <div style={styles.card}>
              <h3>Referral Earnings</h3>
              <h2 style={styles.amount}>${referralTotal.toFixed(2)}</h2>
            </div>
            <div style={styles.card}>
              <h3>Transaction History</h3>
              {rewards.length === 0 ? (
                <p>No wallet transactions recorded yet.</p>
              ) : rewards.map((item, index) => (
                <div key={item.id || index} style={styles.row}>
                  <div>
                    <strong>{item.description || 'Wallet transaction'}</strong>
                    <p style={styles.date}>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : ''}
                    </p>
                  </div>
                  <strong>${Number(item.amount || 0).toFixed(2)}</strong>
                </div>
              ))}
            </div>
            <button onClick={loadData} style={styles.button}>
              Refresh Wallet
            </button>
          </>
        )}

        {page === 'Activities' && (
          <>
            <h2>Available Activities</h2>
            <p>Submit an activity and wait for admin review.</p>

            {activities.length === 0 && !dataLoading && (
              <div style={styles.card}>
                No activities are available right now.
              </div>
            )}

            {activities.map(activity => {
              const submission = activityStatus(activity.id);

              return (
                <div style={styles.card} key={activity.id}>
                  <h3>{activity.Title}</h3>
                  <p>{activity.description}</p>
                  <h3 style={styles.amount}>
                    ${Number(activity.reward_amount || 0).toFixed(2)}
                  </h3>

                  {submission?.status === 'approved' ? (
                    <p style={styles.approved}>Approved</p>
                  ) : submission?.status === 'pending' ? (
                    <p style={styles.pending}>
                      Waiting for admin approval
                    </p>
                  ) : (
                    <button
                      style={styles.button}
                      onClick={() => submitActivity(activity.id)}
                    >
                      Submit Activity
                    </button>
                  )}
                </div>
              );
            })}

            <div style={styles.card}>
              <h3>My Activity Submissions</h3>
              {completions.length === 0 ? (
                <p>You have not submitted any activities.</p>
              ) : completions.map(item => {
                const activity = activities.find(
                  entry => entry.id === item.activity_id
                );

                return (
                  <div key={item.id} style={styles.row}>
                    <span>{activity?.Title || 'Activity'}</span>
                    <strong>{item.status}</strong>
                  </div>
                );
              })}
            </div>

            <button onClick={loadData} style={styles.button}>
              Refresh Activities
            </button>
          </>
        )}

        {page === 'Withdrawals' && (
          <div style={styles.card}>
            <h2>Withdrawals</h2>
            <p>This section is not connected yet.</p>
          </div>
        )}

        {page === 'Admin' && <AdminPanel />}
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
    placeItems: 'center'
  },
  header: {
    background: '#101827',
    color: 'white',
    padding: 22
  },
  logout: {
    padding: 10,
    border: 0,
    borderRadius: 7
  },
  nav: {
    display: 'flex',
    gap: 8,
    padding: 12,
    overflowX: 'auto',
    background: 'white'
  },
  navButton: {
    padding: 11,
    border: 0,
    borderRadius: 8,
    whiteSpace: 'nowrap'
  },
  main: {
    padding: 18,
    maxWidth: 850,
    margin: '0 auto'
  },
  card: {
    background: 'white',
    padding: 20,
    borderRadius: 13,
    marginTop: 15,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  amount: {
    color: '#1768e5',
    fontSize: 28,
    margin: 0
  },
  date: {
    color: '#64748b',
    fontSize: 12
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderBottom: '1px solid #eee',
    padding: '12px 0',
    overflowWrap: 'anywhere'
  },
  button: {
    background: '#1768e5',
    color: 'white',
    padding: '12px 18px',
    border: 0,
    borderRadius: 8,
    marginTop: 10
  },
  approved: {
    color: 'green',
    fontWeight: 'bold'
  },
  pending: {
    color: '#b77900',
    fontWeight: 'bold'
  },
  error: {
    color: '#a40000',
    background: '#ffeaea',
    padding: 12,
    borderRadius: 8
  }
};
