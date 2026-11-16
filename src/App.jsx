import React, { useEffect, useState } from 'react';
import Auth from './Auth';
import AdminPanel from './AdminPanel';
import { supabase } from './supabase';

const money = value => `$${Number(value || 0).toFixed(2)}`;

export default function App() {
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
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setUser(data.session?.user || null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user || null)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) loadData();
    else {
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
      'Profile', 'Plans', 'Wallet', 'Reward history',
      'Membership cycles', 'Referrals', 'Settings', 'Withdrawals'
    ];

    for (let i = 0; i < results.length; i++) {
      if (results[i].error) {
        setError(`${labels[i]}: ${results[i].error.message}`);
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
  }

  const balance = Number(profile?.reward_balance || 0);
  const activeCycle = cycles.find(c => c.status === 'active') || null;
  const activePlan = activeCycle
    ? plans.find(p => p.id === activeCycle.plan_id)
    : null;

  const cycleClaims = activeCycle
    ? claims.filter(c => c.cycle_id === activeCycle.id)
    : [];

  const lastClaim = cycleClaims.reduce((latest, claim) => {
    const date = new Date(claim.created_at || claim.reward_date).getTime();
    return Math.max(latest, date);
  }, 0);

  const cycleStart = activeCycle
    ? new Date(activeCycle.started_at).getTime()
    : 0;

  const nextDue = activeCycle
    ? (lastClaim || cycleStart) + 86400000
    : 0;

  const remainingMs = activeCycle
    ? Math.max(0, nextDue - now)
    : 0;

  const progress = activeCycle
    ? Math.max(0, Math.min(100,
        ((now - (nextDue - 86400000)) / 86400000) * 100
