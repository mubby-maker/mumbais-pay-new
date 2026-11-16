import React, { useEffect, useState } from 'react';
import Auth from './Auth';
import { supabase } from './supabase';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('Dashboard');
  const [plans, setPlans] = useState([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && page === 'Membership') {
      loadPlans();
    }
  }, [user, page]);

  async function loadPlans() {
    setPlanLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('membership_plans')
      .select('id, name, registration_fee, daily_reward, duration_days')
      .eq('is_active', true)
      .order('registration_fee');

    if (error) {
      setError(error.message);
    } else {
      setPlans(data || []);
    }

    setPlanLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  if (loading) return <p>Loading Mumbai's Pay...</p>;
  if (!user) return <Auth onLogin={setUser} />;

  const menu = [
    'Dashboard', 'Membership', 'Daily Rewards',
    'Referrals', 'Wallet', 'Withdrawals', 'Activities'
  ];

  return (
    <div style={{minHeight:'100vh',background:'#f4f6fb'}}>
      <header style={{background:'#101827',color:'white',padding:22}}>
        <h2>MUMBAI'S PAY</h2>
        <p>Welcome, {user.email}</p>
        <button onClick={logout} style={{marginTop:12,padding:9}}>
          Logout
        </button>
      </header>

      <nav style={{display:'flex',gap:8,padding:14,
        overflowX:'auto',background:'white'}}>
        {menu.map(item => (
          <button key={item} onClick={() => setPage(item)}
            style={{padding:10,border:0,borderRadius:8,
              background:page===item?'#1768e5':'#edf1f7',
              color:page===item?'white':'#26344a',
              whiteSpace:'nowrap'}}>
            {item}
          </button>
        ))}
      </nav>

      <main style={{padding:20,maxWidth:850,margin:'auto'}}>
        <h2>{page}</h2>

        {page === 'Dashboard' && (
          <div style={card}>
            <h3>Welcome to Mumbai's Pay</h3>
            <p style={{marginTop:10}}>Your rewards dashboard.</p>
          </div>
        )}

        {page === 'Membership' && (
          <>
            {planLoading && <p>Loading membership plans...</p>}
            {error && <p style={{color:'red'}}>{error}</p>}

            {!planLoading && !error && plans.length === 0 && (
              <p>No active membership plans found.</p>
            )}

            <div style={{display:'grid',gap:16,marginTop:18}}>
              {plans.map(plan => (
                <div key={plan.id} style={card}>
                  <h3>{plan.name}</h3>
                  <h2 style={{color:'#1768e5',margin:'14px 0'}}>
                    ${Number(plan.registration_fee).toFixed(2)}
                  </h2>
                  <p>Daily reward: ${Number(plan.daily_reward).toFixed(2)}</p>
                  <p>Duration: {plan.duration_days} days</p>
                  <button
                    onClick={() => alert('Payment submission is the next step we are building.')}
                    style={button}>
                    Select Plan
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {!['Dashboard','Membership'].includes(page) && (
          <div style={card}>
            {page} functionality is coming next.
          </div>
        )}
      </main>
    </div>
  );
}

const card = {
  background:'white',
  padding:22,
  borderRadius:14,
  marginTop:18
};

const button = {
  marginTop:18,
  padding:12,
  width:'100%',
  background:'#1768e5',
  color:'white',
  border:0,
  borderRadius:8
};
