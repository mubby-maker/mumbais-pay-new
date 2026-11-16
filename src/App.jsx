import React, { useEffect, useState } from 'react';
import Auth from './Auth';
import AdminPanel from './AdminPanel';
import { supabase } from './supabase';

const money = value => `$${Number(value || 0).toFixed(2)}`;
const DAY = 24 * 60 * 60 * 1000;

const styles = {
  app: {
    minHeight: '100vh',
    background: '#f4f6f9',
    color: '#202938',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    background: '#101c35',
    color: '#fff',
    padding: '18px 16px',
  },
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '18px 14px',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '18px',
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  button: {
    background: '#147d55',
    color: '#fff',
    border: 0,
    borderRadius: '8px',
    padding: '12px 16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px',
    margin: '7px 0 14px',
    border: '1px solid #ccd2dc',
    borderRadius: '7px',
    fontSize: '16px',
  },
  label: {
    display: 'block',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  muted: {
    color: '#687386',
    fontSize: '14px',
  },
  nav: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    padding: '12px 0',
  },
  navButton: {
    flex: '0 0 auto',
    border: '1px solid #d5dbe5',
    background: '#fff',
    borderRadius: '8px',
    padding: '10px 13px',
    cursor: 'pointer',
  },
  activeNav: {
    background: '#147d55',
    color: '#fff',
    borderColor: '#147d55',
  },
};

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [claims, setClaims] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [settings, setSettings] = useState({});
  const [withdrawals, setWithdrawals] = useState([]);
  const [page, setPage] = useState('Dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [paymentNetwork, setPaymentNetwork] = useState('TRC20');
  const [transactionHash, setTransactionHash] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawWallet, setWithdrawWallet] = useState('');
  const [withdrawNetwork, setWithdrawNetwork] = useState('TRC20');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setUser(data.session?.user || null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) setUser(session?.user || null);
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
      setLedger([]);
      setClaims([]);
      setCycles([]);
      setReferrals([]);
      setSettings({});
      setWithdrawals([]);
    }
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadData() {
    if (!user) return;

    setLoading(true);
    setError('');

    const results = await Promise.all([
      supabase.from('Profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('membership_plans').select('*').eq('is_active', true),
      supabase.from('reward_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('daily_reward_claims').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('daily_reward_cycles').select('*').eq('user_id', user.id).order('started_at', { ascending: false }),
      supabase.from('referral_rewards').select('*').eq('referrer_user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('website_settings').select('*'),
      supabase.from('withdrawal_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    ]);

    const labels = [
      'Profile',
      'Plans',
      'Wallet',
      'Reward history',
      'Membership cycles',
      'Referrals',
      'Settings',
      'Withdrawals'
    ];

    for (let i = 0; i < results.length; i++) {
      if (results[i].error) {
        setError(`${labels[i]}: ${results[i].error.message}`);
        setLoading(false);
        return;
      }
    }

    setProfile(results[0].data);
    setPlans(results[1].data || []);
    setLedger(results[2].data || []);
    setClaims(results[3].data || []);
    setCycles(results[4].data || []);
    setReferrals(results[5].data || []);

    const settingMap = {};
    (results[6].data || []).forEach(item => {
      settingMap[item.key] = item.value;
    });

    setSettings(settingMap);
    setWithdrawals(results[7].data || []);
    setLoading(false);
  }

  async function submitPayment(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!selectedPlan || !transactionHash.trim()) {
      setError('Choose a plan and enter your transaction hash.');
      return;
    }

    setSubmitting(true);

    const { error: rpcError } = await supabase.rpc(
      'submit_membership_payment',
      {
        p_plan_id: selectedPlan,
        p_network: paymentNetwork,
        p_tx_hash: transactionHash.trim()
      }
    );

    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setTransactionHash('');
    setNotice('Payment submitted. Please wait for admin approval.');
    await loadData();
  }

  async function submitWithdrawal(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    const amount = Number(withdrawAmount);
    const minimum = Number(settings.minimum_withdrawal || 10);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid withdrawal amount.');
      return;
    }

    if (amount < minimum) {
      setError(`The minimum withdrawal is ${money(minimum)}.`);
      return;
    }

    if (amount > balance) {
      setError('Your withdrawal amount is higher than your available balance.');
      return;
    }

    if (!withdrawWallet.trim()) {
      setError('Enter your wallet address.');
      return;
    }

    setSubmitting(true);

    const { error: rpcError } = await supabase.rpc(
      'member_request_withdrawal',
      {
        p_amount: amount,
        p_wallet_address: withdrawWallet.trim(),
        p_network: withdrawNetwork
      }
    );

    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setWithdrawAmount('');
    setWithdrawWallet('');
    setNotice('Withdrawal request submitted for review.');
    await loadData();
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setPage('Dashboard');
  }

  const balance = Number(profile?.reward_balance || 0);
  const activeCycle = cycles.find(c => c.status === 'active') || null;

  const activePlan = activeCycle
    ? plans.find(p => p.id === activeCycle.plan_id)
    : null;

  const cycleClaims = activeCycle
    ? claims.filter(c => c.cycle_id === activeCycle.id)
    : [];

  const cycleStart = activeCycle
    ? new Date(activeCycle.started_at).getTime()
    : 0;

  const nextDue = activeCycle
    ? cycleStart + ((cycleClaims.length + 1) * DAY)
    : 0;

  const remainingMs = activeCycle
    ? Math.max(0, nextDue - now)
    : 0;

  const progress = activeCycle
    ? Math.max(
        0,
        Math.min(
          100,
          ((now - (nextDue - DAY)) / DAY) * 100
        )
      )
    : 0;

  function formatTime(milliseconds) {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div style={{ ...styles.app, padding: '40px', textAlign: 'center' }}>
        Loading Mumbai’s Pay...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.app}>
        <header style={styles.header}>
          <h1 style={{ margin: 0 }}>Mumbai’s Pay</h1>
          <p style={{ marginBottom: 0 }}>Membership rewards platform</p>
        </header>

        <main style={styles.container}>
          <section style={styles.card}>
            <h2>Welcome to Mumbai’s Pay</h2>
            <p>
              Create an account or sign in to access your membership,
              rewards, referrals and withdrawal requests.
            </p>
            <p style={styles.muted}>
              Membership payments and withdrawals are subject to review
              and the programme’s terms.
            </p>
          </section>

          <Auth onLogin={setUser} />
        </main>
      </div>
    );
  }

  const pages = [
    'Dashboard',
    'Membership',
    'Daily Rewards',
    'Referrals',
    'Wallet',
    'Withdrawals',
    'Admin'
  ];

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h1 style={{ margin: 0 }}>Mumbai’s Pay</h1>
          <p style={{ margin: '6px 0 0', color: '#dce5f2' }}>
            Welcome, {profile?.Username || user.email}
          </p>
        </div>
      </header>

      <main style={styles.container}>
        <nav style={styles.nav}>
          {pages.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setPage(item);
                setError('');
                setNotice('');
              }}
              style={{
                ...styles.navButton,
                ...(page === item ? styles.activeNav : {})
              }}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            onClick={signOut}
            style={styles.navButton}
          >
            Sign out
          </button>
        </nav>

        {error && (
          <div style={{
            ...styles.card,
            color: '#a32222',
            border: '1px solid #efbcbc'
          }}>
            {error}
          </div>
        )}

        {notice && (
          <div style={{
            ...styles.card,
            color: '#126b45',
            border: '1px solid #b8e0c9'
          }}>
            {notice}
          </div>
        )}

        {page === 'Dashboard' && (
          <>
            <section style={styles.card}>
              <h2>Dashboard</h2>
              <p style={styles.muted}>Available reward balance</p>
              <h1 style={{ fontSize: '36px', color: '#147d55' }}>
                {money(balance)}
              </h1>
              <p>
                Membership status: <strong>{profile?.Membership_status || 'Not active'}</strong>
              </p>
              <p>
                Membership plan: <strong>{profile?.Membership_plan || 'None'}</strong>
              </p>
            </section>

            <section style={styles.card}>
              <h3>Membership reward cycle</h3>
              {activeCycle && activePlan ? (
                <>
                  <p>
                    Active plan: <strong>{activePlan.name}</strong>
                  </p>
                  <p>
                    Daily reward: <strong>{money(activePlan.daily_reward)}</strong>
                  </p>
                  <p>
                    Rewards credited: <strong>{cycleClaims.length}</strong>
                  </p>
                  <p>
                    Time until next scheduled reward:
                  </p>
                  <h2 style={{ color: '#147d55' }}>
                    {formatTime(remainingMs)}
                  </h2>
                  <div style={{
                    height: '10px',
                    background: '#e5eaf0',
                    borderRadius: '10px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${progress}%`,
                      height: '100%',
                      background: '#147d55'
                    }} />
                  </div>
                  <p style={styles.muted}>
                    Rewards are processed automatically by the system.
                    The countdown is an estimate of the next scheduled cycle.
                  </p>
                </>
              ) : (
                <p>
                  You do not currently have an active membership cycle.
                  Visit Membership to view the available plans.
                </p>
              )}
            </section>

            <section style={styles.card}>
              <h3>Referral code</h3>
              <p style={{ fontSize: '20px', fontWeight: 'bold' }}>
                {profile?.Referral_code || 'Not available'}
              </p>
              <p style={styles.muted}>
                Referral bonus: {money(settings.referral_bonus || 0.5)}
              </p>
            </section>
          </>
        )}

        {page === 'Membership' && (
          <>
            <section style={styles.card}>
              <h2>Membership plans</h2>
              <p style={styles.muted}>
                Review the plan terms before making a payment.
                Payment approval is handled manually by the admin.
              </p>

              {plans.length === 0 && (
                <p>No active membership plans are available.</p>
              )}

              {plans.map(plan => (
                <div
                  key={plan.id}
                  style={{
                    border: '1px solid #dce2e9',
                    borderRadius: '10px',
                    padding: '15px',
                    margin: '12px 0'
                  }}
                >
                  <h3>{plan.name}</h3>
                  <p>Registration fee: <strong>{money(plan.registration_fee)}</strong></p>
                  <p>Listed daily reward: <strong>{money(plan.daily_reward)}</strong></p>
                  <p>Plan duration: <strong>{plan.duration_days} days</strong></p>
                  <button
                    type="button"
                    style={styles.button}
                    onClick={() => {
                      setSelectedPlan(plan.id);
                      setPage('Membership');
                    }}
                  >
                    Select this plan
                  </button>
                </div>
              ))}
            </section>

            <section style={styles.card}>
              <h3>Submit membership payment</h3>
              <form onSubmit={submitPayment}>
                <label style={styles.label}>Selected plan</label>
                <select
                  style={styles.input}
                  value={selectedPlan}
                  onChange={event => setSelectedPlan(event.target.value)}
                  required
                >
                  <option value="">Choose a plan</option>
                  {plans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — {money(plan.registration_fee)}
                    </option>
                  ))}
                </select>

                <label style={styles.label}>Payment network</label>
                <select
                  style={styles.input}
                  value={paymentNetwork}
                  onChange={event => setPaymentNetwork(event.target.value)}
                >
                  <option value="TRC20">USDT TRC20</option>
                  <option value="BEP20">USDT BEP20</option>
                </select>

                <label style={styles.label}>Transaction hash</label>
                <input
                  style={styles.input}
                  value={transactionHash}
                  onChange={event => setTransactionHash(event.target.value)}
                  placeholder="Enter your transaction hash"
                  required
                />

                <button
                  style={styles.button}
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit payment'}
                </button>
              </form>
            </section>
          </>
        )}

        {page === 'Daily Rewards' && (
          <section style={styles.card}>
            <h2>Daily Rewards</h2>

            {activeCycle && activePlan ? (
              <>
                <p>Active plan: <strong>{activePlan.name}</strong></p>
                <p>Daily reward amount: <strong>{money(activePlan.daily_reward)}</strong></p>
                <p>Rewards credited in this cycle: <strong>{cycleClaims.length}</strong></p>
                <h2 style={{ color: '#147d55' }}>
                  {formatTime(remainingMs)}
                </h2>
                <p style={styles.muted}>
                  The reward process runs automatically. You do not need
                  to submit daily proof or click a claim button.
                </p>
              </>
            ) : (
              <p>You need an approved active membership to receive cycle rewards.</p>
            )}

            <h3>Reward history</h3>
            {claims.length === 0 ? (
              <p style={styles.muted}>No daily rewards have been recorded yet.</p>
            ) : (
              claims.map(claim => (
                <div
                  key={claim.id}
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid #e5eaf0'
                  }}
                >
                  <strong>{money(claim.amount)}</strong>
                  <div style={styles.muted}>
                    {claim.reward_date || claim.created_at}
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {page === 'Referrals' && (
          <section style={styles.card}>
            <h2>Referrals</h2>
            <p>Your referral code:</p>
            <h2 style={{ color: '#147d55' }}>
              {profile?.Referral_code || 'Not available'}
            </h2>
            <p style={styles.muted}>
              Share this code with people who register. Referral rewards
              are subject to the programme’s verification process.
            </p>
            <p>
              Referral bonus setting: <strong>{money(settings.referral_bonus || 0.5)}</strong>
            </p>
            <h3>Referral rewards</h3>
            {referrals.length === 0 ? (
              <p style={styles.muted}>No referral rewards recorded yet.</p>
            ) : (
              referrals.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid #e5eaf0'
                  }}
                >
                  <strong>{money(item.amount)}</strong>
                  <div style={styles.muted}>{item.created_at}</div>
                </div>
              ))
            )}
          </section>
        )}

        {page === 'Wallet' && (
          <section style={styles.card}>
            <h2>Wallet</h2>
            <h1 style={{ color: '#147d55' }}>{money(balance)}</h1>
            <h3>Transaction history</h3>
            {ledger.length === 0 ? (
              <p style={styles.muted}>No wallet transactions yet.</p>
            ) : (
              ledger.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #e5eaf0'
                  }}
                >
                  <strong>{money(item.amount)}</strong>
                  <div>{item.description}</div>
                  <div style={styles.muted}>{item.created_at}</div>
                </div>
              ))
            )}
          </section>
        )}

        {page === 'Withdrawals' && (
          <>
            <section style={styles.card}>
              <h2>Request withdrawal</h2>
              <p>Available balance: <strong>{money(balance)}</strong></p>
              <p>
                Minimum withdrawal: <strong>{money(settings.minimum_withdrawal || 10)}</strong>
              </p>

              <form onSubmit={submitWithdrawal}>
                <label style={styles.label}>Amount (USD)</label>
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={withdrawAmount}
                  onChange={event => setWithdrawAmount(event.target.value)}
                  required
                />

                <label style={styles.label}>Network</label>
                <select
                  style={styles.input}
                  value={withdrawNetwork}
                  onChange={event => setWithdrawNetwork(event.target.value)}
                >
                  <option value="TRC20">USDT TRC20</option>
                  <option value="BEP20">USDT BEP20</option>
                </select>

                <label style={styles.label}>USDT wallet address</label>
                <input
                  style={styles.input}
                  value={withdrawWallet}
                  onChange={event => setWithdrawWallet(event.target.value)}
                  placeholder="Enter your receiving wallet address"
                  required
                />

                <button
                  type="submit"
                  style={styles.button}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit withdrawal request'}
                </button>
              </form>
            </section>

            <section style={styles.card}>
              <h3>Withdrawal history</h3>
              {withdrawals.length === 0 ? (
                <p style={styles.muted}>No withdrawal requests yet.</p>
              ) : (
                withdrawals.map(item => (
                  <div
                    key={item.id}
                    style={{
                      padding: '12px 0',
                      borderBottom: '1px solid #e5eaf0'
                    }}
                  >
                    <strong>{money(item.amount)}</strong>
                    <div>Status: {item.status}</div>
                    <div style={styles.muted}>
                      {item.network} · {item.created_at}
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}

        {page === 'Admin' && (
          <AdminPanel />
        )}

        {page !== 'Admin' && (
          <button
            type="button"
            style={{ ...styles.button, marginTop: '8px' }}
            onClick={loadData}
          >
            Refresh information
          </button>
        )}
      </main>
    </div>
  );
}

export default App;
