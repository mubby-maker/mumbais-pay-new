import React, { useEffect, useState } from 'react';
import Auth from './Auth';
import AdminPanel from './AdminPanel';
import { supabase } from './supabase';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [claims, setClaims] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [activities, setActivities] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [settings, setSettings] = useState({});
  const [page, setPage] = useState('Dashboard');
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selectedPlan, setSelectedPlan] = useState('');
  const [paymentNetwork, setPaymentNetwork] = useState('TRC20');
  const [transactionHash, setTransactionHash] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawWallet, setWithdrawWallet] = useState('');
  const [withdrawNetwork, setWithdrawNetwork] = useState('TRC20');
  const [submitting, setSubmitting] = useState(false);

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
    if (user) {
      loadData();
    } else {
      setProfile(null);
      setPlans([]);
      setRewards([]);
      setClaims([]);
      setCycles([]);
      setReferrals([]);
      setActivities([]);
      setCompletions([]);
      setSettings({});
    }
  }, [user]);

  async function loadData() {
    if (!user) return;

    setDataLoading(true);
    setError('');

    try {
      const [
        profileResult,
        planResult,
        rewardResult,
        claimResult,
        cycleResult,
        referralResult,
        activityResult,
        completionResult,
        settingsResult
      ] = await Promise.all([
        supabase.from('Profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),

        supabase.from('membership_plans')
          .select('*')
          .eq('is_active', true),

        supabase.from('reward_ledger')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        supabase.from('daily_reward_claims')
          .select('*')
          .eq('user_id', user.id)
          .order('reward_date', { ascending: false }),

        supabase.from('daily_reward_cycles')
          .select('*')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false }),

        supabase.from('referral_rewards')
          .select('*')
          .eq('referrer_user_id', user.id)
          .order('created_at', { ascending: false }),

        supabase.from('activities')
          .select('*')
          .eq('is_actice', true)
          .order('created_at', { ascending: false }),

        supabase.from('activity_completions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        supabase.from('website_settings')
          .select('*')
      ]);

      if (profileResult.error) throw profileResult.error;
      if (planResult.error) throw planResult.error;
      if (rewardResult.error) throw rewardResult.error;
      if (claimResult.error) throw claimResult.error;
      if (cycleResult.error) throw cycleResult.error;
      if (referralResult.error) throw referralResult.error;
      if (activityResult.error) throw activityResult.error;
      if (completionResult.error) throw completionResult.error;
      if (settingsResult.error) throw settingsResult.error;

      setProfile(profileResult.data);
      setPlans(planResult.data || []);
      setRewards(rewardResult.data || []);
      setClaims(claimResult.data || []);
      setCycles(cycleResult.data || []);
      setReferrals(referralResult.data || []);
      setActivities(activityResult.data || []);
      setCompletions(completionResult.data || []);

      const settingMap = {};
      (settingsResult.data || []).forEach(item => {
        settingMap[item.key] = item.value;
      });
      setSettings(settingMap);
    } catch (err) {
      setError(err.message || 'Could not load account information.');
    } finally {
      setDataLoading(false);
    }
  }

  async function submitMembershipPayment(event) {
    event.preventDefault();

    if (!selectedPlan) {
      setError('Please select a membership plan.');
      return;
    }

    if (!transactionHash.trim()) {
      setError('Please enter your transaction hash.');
      return;
    }

    const address = paymentNetwork === 'TRC20'
      ? settings.usdt_trc20_address
      : settings.usdt_bep20_address;

    if (!address) {
      setError('The admin has not configured this payment wallet yet.');
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const { error } = await supabase.rpc(
        'submit_membership_payment',
        {
          p_plan_id: selectedPlan,
          p_network: paymentNetwork,
          p_tx_hash: transactionHash.trim()
        }
      );

      if (error) throw error;

      setNotice('Payment submitted. Your membership is waiting for admin verification.');
      setTransactionHash('');
      setSelectedPlan('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Could not submit payment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitWithdrawal(event) {
    event.preventDefault();

    const amount = Number(withdrawAmount);
    const minimum = Number(settings.minimum_withdrawal || 10);

    if (!Number.isFinite(amount) || amount < minimum) {
      setError(`The minimum withdrawal is $${minimum.toFixed(2)}.`);
      return;
    }

    if (amount > balance) {
      setError('Your withdrawal amount is greater than your available balance.');
      return;
    }

    if (!withdrawWallet.trim()) {
      setError('Please enter your receiving wallet address.');
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const { error } = await supabase.rpc(
        'member_request_withdrawal',
        {
          p_amount: amount,
          p_wallet_address: withdrawWallet.trim(),
          p_network: withdrawNetwork
        }
      );

      if (error) throw error;

      setNotice('Withdrawal request submitted for admin review.');
      setWithdrawAmount('');
      setWithdrawWallet('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Could not submit withdrawal request.');
    } finally {
      setSubmitting(false);
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
    (total, item) => total + Number(item.amount || 0),
    0
  );

  const activeCycle = cycles.find(cycle => cycle.status === 'active');

  const activePlan = activeCycle
    ? plans.find(plan => plan.id === activeCycle.plan_id)
    : null;

  const activeCycleClaims = activeCycle
    ? claims.filter(claim => claim.cycle_id === activeCycle.id)
    : [];

  const dailyRewardsCount = activeCycleClaims.length;

  const dailyRewardTotal = activeCycleClaims.reduce(
    (total, claim) => total + Number(claim.amount || 0),
    0
  );

  const remainingDays = activeCycle && activePlan
    ? Math.max(activePlan.duration_days - dailyRewardsCount, 0)
    : null;

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
            onClick={() => {
              setError('');
              setNotice('');
              setPage(item);
            }}
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
        {notice && <div style={styles.success}>{notice}</div>}

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
              <p>Daily Rewards Credited</p>
              <h1 style={styles.amount}>{dailyRewardsCount}</h1>
              <p>Days remaining in active cycle: {remainingDays ?? 'No active cycle'}</p>
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
                <p>Registration Fee: ${Number(plan.registration_fee).toFixed(2)}</p>
                <p>Daily Reward: ${Number(plan.daily_reward).toFixed(2)}</p>
                <p>Duration: {plan.duration_days} days</p>
              </div>
            ))}

            <form style={styles.card} onSubmit={submitMembershipPayment}>
              <h3>Submit Membership Payment</h3>

              <label style={styles.label}>Choose plan</label>
              <select
                style={styles.input}
                value={selectedPlan}
                onChange={e => setSelectedPlan(e.target.value)}
                required
              >
                <option value="">Select a plan</option>
                {plans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — ${Number(plan.registration_fee).toFixed(2)}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Payment network</label>
              <select
                style={styles.input}
                value={paymentNetwork}
                onChange={e => setPaymentNetwork(e.target.value)}
              >
                <option value="TRC20">USDT TRC20</option>
                <option value="BEP20">USDT BEP20</option>
              </select>

              <p>
                Payment address:{' '}
                {paymentNetwork === 'TRC20'
                  ? settings.usdt_trc20_address || 'Admin has not added an address yet.'
                  : settings.usdt_bep20_address || 'Admin has not added an address yet.'}
              </p>

              <label style={styles.label}>Transaction hash</label>
              <input
                style={styles.input}
                value={transactionHash}
                onChange={e => setTransactionHash(e.target.value)}
                placeholder="Enter your transaction hash"
                required
              />

              <button
                style={styles.button}
                disabled={submitting}
                type="submit"
              >
                {submitting ? 'Submitting...' : 'Submit Payment'}
              </button>
            </form>
          </>
        )}

        {page === 'Daily Rewards' && (
          <>
            <h2>Daily Rewards</h2>

            <div style={styles.card}>
              <p>Current Reward Balance</p>
              <h1 style={styles.amount}>${balance.toFixed(2)}</h1>
            </div>

            <div style={styles.card}>
              <p>Daily Rewards Credited</p>
              <h1 style={styles.amount}>{dailyRewardsCount}</h1>
              <p>Total credited in active cycle: ${dailyRewardTotal.toFixed(2)}</p>
              <p>
                Days remaining in active cycle: {remainingDays ?? 'No active cycle'}
              </p>
            </div>

            <div style={styles.card}>
              <h3>Daily Reward History</h3>

              {activeCycleClaims.length === 0 ? (
                <p>No daily rewards have been credited in this cycle yet.</p>
              ) : (
                activeCycleClaims.map(claim => (
                  <div key={claim.id} style={styles.row}>
                    <span>{claim.reward_date}</span>
                    <strong>${Number(claim.amount).toFixed(2)}</strong>
                  </div>
                ))
              )}
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
              <h3>Recorded Referrals: {referrals.length}</h3>

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
            </div>

            <div style={styles.card}>
              <h3>Referral Earnings</h3>
              <h2 style={styles.amount}>${referralTotal.toFixed(2)}</h2>
            </div>

            <div style={styles.card}>
              <h3>Transaction History</h3>

              {rewards.length === 0 ? (
                <p>No wallet transactions recorded yet.</p>
              ) : (
                rewards.map((item, index) => (
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
                ))
              )}
            </div>

            <button onClick={loadData} style={styles.button}>
              Refresh Wallet
            </button>
          </>
        )}

        {page === 'Withdrawals' && (
          <>
            <h2>Withdrawals</h2>

            <div style={styles.card}>
              <p>Available Balance</p>
              <h1 style={styles.amount}>${balance.toFixed(2)}</h1>
              <p>
                Minimum withdrawal: $
                {Number(settings.minimum_withdrawal || 10).toFixed(2)}
              </p>
            </div>

            <form style={styles.card} onSubmit={submitWithdrawal}>
              <h3>Request Withdrawal</h3>

              <label style={styles.label}>Amount in USD</label>
              <input
                style={styles.input}
                type="number"
                min={Number(settings.minimum_withdrawal || 10)}
                step="0.01"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                required
              />

              <label style={styles.label}>Network</label>
              <select
                style={styles.input}
                value={withdrawNetwork}
                onChange={e => setWithdrawNetwork(e.target.value)}
              >
                <option value="TRC20">USDT TRC20</option>
                <option value="BEP20">USDT BEP20</option>
              </select>

              <label style={styles.label}>Receiving wallet address</label>
              <input
                style={styles.input}
                value={withdrawWallet}
                onChange={e => setWithdrawWallet(e.target.value)}
                placeholder="Enter your USDT wallet address"
                required
              />

              <button
                style={styles.button}
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Withdrawal Request'}
              </button>
            </form>
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
              ) : (
                completions.map(item => {
                  const activity = activities.find(
                    entry => entry.id === item.activity_id
                  );

                  return (
                    <div key={item.id} style={styles.row}>
                      <span>{activity?.Title || 'Activity'}</span>
                      <strong>{item.status}</strong>
                    </div>
                  );
                })
              )}
            </div>

            <button onClick={loadData} style={styles.button}>
              Refresh Activities
            </button>
          </>
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
  label: {
    display: 'block',
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 6
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 12,
    border: '1px solid #ccd3df',
    borderRadius: 8,
    marginBottom: 8
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
  },
  success: {
    color: '#176b3a',
    background: '#e5f7ec',
    padding: 12,
    borderRadius: 8
  }
};
