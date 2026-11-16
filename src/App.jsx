import React, { useEffect, useState } from 'react';
import Auth from './Auth';
import { supabase } from './supabase';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('Dashboard');

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

      <main style={{padding:20}}>
        <h2>{page}</h2>
        <div style={{background:'white',padding:22,
          borderRadius:14,marginTop:15}}>
          {page === 'Dashboard'
            ? 'Your Mumbai’s Pay dashboard'
            : `${page} section`}
        </div>
      </main>
    </div>
  );
}
