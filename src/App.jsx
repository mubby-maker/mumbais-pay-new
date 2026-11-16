import React, { useState } from 'react';

export default function App() {
  const [page, setPage] = useState('Dashboard');

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
    <div style={{minHeight:'100vh',background:'#f4f6fb'}}>
      <header style={{
        background:'#101827',color:'white',
        padding:'22px 18px'
      }}>
        <h2>MUMBAI'S PAY</h2>
        <p style={{color:'#aab6ca',marginTop:6}}>
          Rewards • Membership • Community
        </p>
      </header>

      <nav style={{
        display:'flex',gap:9,padding:14,
        overflowX:'auto',background:'white'
      }}>
        {menu.map(item => (
          <button key={item}
            onClick={() => setPage(item)}
            style={{
              padding:'10px 14px',
              border:0,borderRadius:8,
              background:page===item?'#1768e5':'#edf1f7',
              color:page===item?'white':'#26344a',
              whiteSpace:'nowrap'
            }}>
            {item}
          </button>
        ))}
      </nav>

      <main style={{padding:18,maxWidth:850,margin:'auto'}}>
        <h2 style={{marginBottom:18}}>{page}</h2>

        {page==='Dashboard' ? (
          <>
            <div style={{
              background:'#1768e5',color:'white',
              padding:25,borderRadius:16
            }}>
              <p>Available Reward Balance</p>
              <h1 style={{fontSize:36,margin:'12px 0'}}>$0.00</h1>
              <p>Welcome to Mumbai's Pay</p>
            </div>

            <div style={{
              display:'grid',
              gridTemplateColumns:'repeat(2,minmax(0,1fr))',
              gap:12,marginTop:18
            }}>
              {[
                ['Membership','Choose your plan'],
                ['Daily Rewards','View reward details'],
                ['Referrals','Invite friends'],
                ['Wallet','Manage your balance']
              ].map(([title,desc]) => (
                <button key={title}
                  onClick={() => setPage(title)}
                  style={{
                    background:'white',border:0,
                    borderRadius:12,padding:18,
                    textAlign:'left',minHeight:105
                  }}>
                  <strong>{title}</strong>
                  <p style={{color:'#718096',marginTop:9}}>
                    {desc}
                  </p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{
            background:'white',padding:22,
            borderRadius:14
          }}>
            <p>{page} information will appear here.</p>
          </div>
        )}
      </main>
    </div>
  );
}
