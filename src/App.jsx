import React, { useEffect, useState } from 'react';
import Auth from './Auth';
import { supabase } from './supabase';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [page, setPage] = useState('Dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setError('');

    const { data: profileData, error: profileError } =
      await supabase
        .from('Profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError) {
      setError('Could not load your profile: ' + profileError.message);
    } else {
      setProfile(profileData);
    }

    const { data: planData, error: planError } =
      await supabase
        .from('membership_plans')
        .select('*')
        .eq('is_active', true);

    if (planError) {
      setError('Could not load membership plans: ' + planError.message);
    } else {
      setPlans(planData || []);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  if (loading) return <p>Loading Mumbai's Pay...</p>;

  if (!user) return <Auth onLogin={setUser} />;

  const menu = [
    'Dashboard',
    'Membership',
    'Daily Rewards',
    'Referrals',
    'Wallet',
    'Withdrawals',
    'Activities'
  ];

  const balance = Number(profile?.reward_balance || 0);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h2>MUMBAI'S PAY</h2>
        <p>Welcome, {profile?.Username || user.email}</p>
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
              color: page === item ? 'white' : '#26344a'
            }}
          >
            {item}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {error && <p style={styles.error}>{error}</p>}

        {page === 'Dashboard' && (
          <>
            <h2>Dashboard</h2>

            <div style={styles.card}>
              <p>Available Reward Balance</p>
              <h1>${balance.toFixed(2)}</h1>
            </div>

            <div style={styles.card}>
              <p>Membership Plan</p>
              <h3>{profile?.Membership_plan || 'No active
