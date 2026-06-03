import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Package, Boxes, ArchiveX, ArrowLeftRight, CarFront,
  TrendingUp, Activity, ChevronRight, ChevronUp,
  CreditCard, HardDrive, AlertTriangle,
  Globe, Lock, ShieldAlert, ChevronLeft
} from 'lucide-react';
import { dashboardAPI, transfersAPI, vehiclesAPI, subscriptionsAPI, clearAPI, settingsAPI } from '../services/api';
import { cachedAPI } from '../services/apiCache';
import { LoadingPage } from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ data }) {
  const [hovered, setHovered] = useState(null);
  const COLORS = ['#f43f5e','#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
  const total = data.reduce((s, d) => s + (d.count || 0), 0);
  const size = 180;
  const r = 65, cx = size / 2, cy = size / 2, strokeW = 26;
  const circ = 2 * Math.PI * r;

  let cum = 0;
  const slices = data.map((d, i) => {
    const pct = total ? (d.count || 0) / total : 0;
    const start = cum;
    cum += pct;
    return { ...d, pct, start, color: COLORS[i % COLORS.length] };
  });

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={strokeW} stroke="rgba(128,128,128,0.15)" />
          {slices.map((s, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color}
              strokeWidth={hovered === i ? strokeW + 6 : strokeW}
              strokeDasharray={`${s.pct * circ} ${circ}`}
              strokeDashoffset={-s.start * circ}
              style={{ transition: 'stroke-width 0.25s ease, opacity 0.25s ease', cursor: 'pointer',
                opacity: hovered !== null && hovered !== i ? 0.35 : 1 }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <AnimatePresence mode="wait">
            {hovered !== null ? (
              <motion.div key="h" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="text-center">
                <div className="text-2xl font-bold">{slices[hovered].count}</div>
                <div className="text-xs text-muted-foreground max-w-[80px] text-center leading-tight">{slices[hovered].name}</div>
                <div className="text-xs font-semibold mt-0.5" style={{ color: slices[hovered].color }}>{(slices[hovered].pct * 100).toFixed(0)}%</div>
              </motion.div>
            ) : (
              <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                <div className="text-3xl font-bold">{total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 w-full">
        {slices.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200"
            style={{ background: hovered === i ? s.color + '18' : 'transparent', transform: hovered === i ? 'translateX(4px)' : 'none' }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color, boxShadow: hovered === i ? `0 0 8px ${s.color}` : 'none', transition: 'box-shadow 0.2s' }} />
              <span className="text-sm font-medium">{s.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 rounded-full bg-muted overflow-hidden" style={{ width: 60 }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${s.pct * 100}%` }} transition={{ duration: 0.1 }}
                  className="h-full rounded-full" style={{ background: s.color }} />
              </div>
              <span className="text-sm font-bold w-6 text-right">{s.count}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ data }) {
  const [hovered, setHovered] = useState(null);
  const COLORS = ['#f43f5e','#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
  const max = Math.max(...data.map(d => d.count || 0), 1);

  return (
    <div className="flex items-end gap-3 w-full pt-4" style={{ height: 220 }}>
      {data.map((d, i) => {
        const pct = (d.count || 0) / max;
        const color = COLORS[i % COLORS.length];
        const isH = hovered === i;
        return (
          <div key={i} className="flex flex-col items-center flex-1 h-full justify-end"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}>
            {/* Count — always visible, pops on hover */}
            <motion.div
              animate={{ y: isH ? -4 : 0, scale: isH ? 1.2 : 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="text-sm font-bold mb-2 tabular-nums"
              style={{ color: isH ? color : 'var(--foreground)', transition: 'color 0.2s' }}>
              {d.count || 0}
            </motion.div>
            {/* Track */}
            <div className="relative w-full flex items-end rounded-xl overflow-hidden"
              style={{ height: '160px', background: `${color}18` }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(pct * 100, 5)}%` }}
                transition={{ delay: i * 0.03, type: 'spring', stiffness: 400, damping: 30 }}
                className="w-full rounded-xl"
                style={{
                  background: color,
                  boxShadow: isH ? `0 0 24px ${color}70` : 'none',
                  transition: 'box-shadow 0.25s',
                  opacity: hovered !== null && !isH ? 0.3 : 1,
                }} />
            </div>
            {/* Label */}
            <motion.span
              animate={{ color: isH ? color : 'var(--muted-foreground)' }}
              transition={{ duration: 0.2 }}
              className="text-xs mt-2 truncate w-full text-center font-medium">
              {d.name}
            </motion.span>
          </div>
        );
      })}
    </div>
  );
}

// ── Assignment Ring ───────────────────────────────────────────────────────────
function AssignmentRing({ assigned, inventory, total }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setTimeout(() => setAnimated(true), 150); }, []);
  const pct = total ? assigned / total : 0;
  const invPct = total ? inventory / total : 0;
  const size = 140, r = 52, cx = size / 2, cy = size / 2, sw = 20;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8">
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={sw} stroke="rgba(128,128,128,0.12)" />
          <motion.circle cx={cx} cy={cy} r={r} fill="none" stroke="#f59e0b" strokeWidth={sw}
            strokeDasharray={`${circ} ${circ}`}
            animate={{ strokeDashoffset: animated ? circ * (1 - invPct) : circ }}
            initial={{ strokeDashoffset: circ }}
            transition={{ duration: 0.15, ease: 'easeOut', delay: 0.2 }}
            strokeLinecap="round" />
          <motion.circle cx={cx} cy={cy} r={r} fill="none" stroke="#10b981" strokeWidth={sw}
            strokeDasharray={`${circ} ${circ}`}
            animate={{ strokeDashoffset: animated ? circ * (1 - pct) : circ }}
            initial={{ strokeDashoffset: circ }}
            transition={{ duration: 0.15, ease: 'easeOut', delay: 0.4 }}
            strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1, type: 'spring' }}
            className="text-2xl font-bold">{Math.round(pct * 100)}%</motion.div>
          <div className="text-xs text-muted-foreground">assigned</div>
        </div>
      </div>
      <div className="flex flex-col gap-4 flex-1">
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Assigned</span>
            <span className="font-bold">{assigned}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }}
              transition={{ delay: 0.6, duration: 0.15, ease: 'easeOut' }}
              className="h-full rounded-full bg-emerald-500" />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />In Inventory</span>
            <span className="font-bold">{inventory}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${invPct * 100}%` }}
              transition={{ delay: 0.8, duration: 0.15, ease: 'easeOut' }}
              className="h-full rounded-full bg-amber-500" />
          </div>
        </div>
        <div className="text-xs text-muted-foreground pt-1">{total} total assets tracked</div>
      </div>
    </div>
  );
}

// ── Animated Counter ─────────────────────────────────────────────────────────
function useCountUp(target, delay = 0, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      const steps = 40;
      const increment = target / steps;
      let current = 0;
      const interval = setInterval(() => {
        current += increment;
        if (current >= target) { setCount(target); clearInterval(interval); }
        else setCount(Math.floor(current));
      }, duration / steps);
      return () => clearInterval(interval);
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [target, delay, duration]);
  return count;
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ title, value, icon: Icon, color, delay, onClick, subtitle }) {
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);
  const animatedValue = useCountUp(value, delay + 0.2);

  const handleMouseMove = useCallback((e) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -16;
    setTilt({ x, y });
  }, []);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 180 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTilt({ x: 0, y: 0 }); }}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      className="relative rounded-2xl border bg-card p-6 cursor-pointer overflow-hidden select-none"
      style={{
        borderColor: hovered ? color + '70' : 'var(--border)',
        transform: `perspective(600px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) ${hovered ? 'translateY(-4px)' : ''}`,
        transition: 'border-color 0.25s, transform 0.15s ease-out',
        boxShadow: hovered ? `0 20px 40px ${color}25, 0 0 0 1px ${color}30` : undefined,
      }}
    >
      <motion.div animate={{ opacity: hovered ? 1 : 0 }} transition={{ duration: 0.15 }}
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 20% 20%, ${color}18, transparent 65%)` }} />
      <motion.div animate={{ scale: hovered ? 1.2 : 1, opacity: hovered ? 0.7 : 0.2 }} transition={{ duration: 0.15 }}
        className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: color + '40' }} />
      <motion.div animate={{ scale: hovered ? 1.3 : 1, opacity: hovered ? 0.3 : 0.1 }} transition={{ duration: 0.15 }}
        className="absolute -right-2 -bottom-2 w-16 h-16 rounded-full pointer-events-none"
        style={{ background: color }} />
      <div className="relative">
        <div className="flex items-start justify-between mb-5">
          <motion.div animate={{ scale: hovered ? 1.12 : 1, rotate: hovered ? 5 : 0 }} transition={{ type: 'spring', stiffness: 300 }}
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: color + '20', boxShadow: hovered ? `0 0 20px ${color}60` : 'none', transition: 'box-shadow 0.3s' }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </motion.div>
          <motion.div animate={{ x: hovered ? 3 : 0, opacity: hovered ? 1 : 0.35 }}>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </motion.div>
        </div>
        <div className="text-4xl font-bold mb-1 tabular-nums" style={{ color: hovered ? color : undefined, transition: 'color 0.3s' }}>
          {animatedValue}
        </div>
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        {subtitle && (
          <motion.div animate={{ opacity: hovered ? 1 : 0.6 }}
            className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <ChevronUp className="w-3 h-3" style={{ color }} />
            {subtitle}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ── Transfer Row ─────────────────────────────────────────────────────────────
function TransferRow({ transfer, index }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-3 py-3 border-b border-border last:border-0 cursor-default transition-all duration-200"
      style={{ background: hovered ? 'rgba(var(--primary-rgb, 244,63,94), 0.04)' : 'transparent', borderRadius: 10, padding: hovered ? '12px 8px' : '12px 0' }}>
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {transfer.assetModelNumber
            ? `${transfer.assetModelNumber} transferred`
            : `${transfer.assetTypeName || 'Asset'} transferred`}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {transfer.fromName || 'Inventory'} → {transfer.toName || 'Inventory'}
        </div>
      </div>
      <div className="text-xs text-muted-foreground flex-shrink-0">
        {transfer.formattedDate
          ? transfer.formattedDate.split('–')[0].trim()
          : transfer.date ? new Date(transfer.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'
        }
      </div>
    </motion.div>
  );
}

// ── Vehicle Fleet Widget ─────────────────────────────────────────────────────
function getVehicleImageUrl(path) {
  if (!path) return '';
  return path.startsWith('http') ? path : vehiclesAPI.getFileUrl(path.split('/').pop());
}

function VehicleFleetWidget({ vehicles, navigate }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeVehicle = vehicles[activeIndex] || null;
  const hasMultiple = vehicles.length > 1;

  useEffect(() => {
    setActiveIndex(index => (vehicles.length ? Math.min(index, vehicles.length - 1) : 0));
  }, [vehicles.length]);

  const goPrev = () => {
    if (!vehicles.length) return;
    setActiveIndex(index => (index - 1 + vehicles.length) % vehicles.length);
  };

  const goNext = () => {
    if (!vehicles.length) return;
    setActiveIndex(index => (index + 1) % vehicles.length);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
      className="rounded-2xl border bg-card p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <CarFront className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Vehicle Fleet</h2>
            <p className="text-xs text-muted-foreground">{vehicles.length} total vehicles</p>
          </div>
        </div>
        <button onClick={() => navigate('/vehicles')}
          className="text-xs text-primary hover:underline flex items-center gap-1 transition-opacity hover:opacity-80">
          View all <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {activeVehicle ? (
        <div className="relative min-h-[250px] rounded-2xl bg-muted/30 p-4">
          <div className="absolute inset-x-6 bottom-16 h-12 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex min-h-[180px] items-center justify-center">
            <button
              type="button"
              onClick={goPrev}
              disabled={!hasMultiple}
              className="absolute left-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border bg-background/80 text-muted-foreground backdrop-blur transition hover:text-foreground disabled:cursor-default disabled:opacity-35"
              aria-label="Previous vehicle"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <AnimatePresence mode="wait" initial={false}>
              <motion.img
                key={activeVehicle.id}
                src={getVehicleImageUrl(activeVehicle.imageUrl)}
                alt={activeVehicle.name}
                initial={{ opacity: 0, x: 18, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -18, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="max-h-40 w-full object-contain drop-shadow-2xl"
                draggable={false}
              />
            </AnimatePresence>

            <button
              type="button"
              onClick={goNext}
              disabled={!hasMultiple}
              className="absolute right-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border bg-background/80 text-muted-foreground backdrop-blur transition hover:text-foreground disabled:cursor-default disabled:opacity-35"
              aria-label="Next vehicle"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mt-2 text-center">
            <div className="text-lg font-semibold truncate">{activeVehicle.name}</div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {vehicles.map((vehicle, index) => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: index === activeIndex ? 22 : 8,
                    background: index === activeIndex ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground) / 0.3)',
                  }}
                  aria-label={`Show ${vehicle.name}`}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {activeIndex + 1} of {vehicles.length}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-56 text-muted-foreground text-sm gap-2 rounded-2xl bg-muted/30">
          <CarFront className="w-8 h-8 opacity-25" />
          No vehicles added yet
        </div>
      )}
    </motion.div>
  );
}

// ── Subscriptions Widget ─────────────────────────────────────────────────────
function formatCurrency(amount, currency) {
  if (!amount) return '—';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0 }).format(amount); }
  catch { return `${currency || 'USD'} ${amount}`; }
}

function SubscriptionsWidget({ subs, navigate, displayCurrency = 'USD', exchangeRate = 1, showCosts = true, expiryWarningDays = 30 }) {
  const [hovered, setHovered] = useState(null);

  const active = subs.filter(s => s.renewalStatus !== 'expired');
  const expired = subs.filter(s => s.renewalStatus === 'expired');
  const expiringSoon = subs.filter(s => s.renewalStatus === 'expiring_soon');

  // Convert sub price to displayCurrency without double-converting.
  // exchangeRate = 1 USD -> displayCurrency (e.g. 3.67 for AED).
  // If sub is ALREADY in displayCurrency -> no conversion (ratio=1).
  const toDisplay = (price, subCurrency) => {
    const p = parseFloat(price) || 0;
    const sc = (subCurrency || 'USD').toUpperCase();
    const dc = (displayCurrency || 'USD').toUpperCase();
    if (sc === dc) return p;
    if (sc === 'USD') return p * exchangeRate;
    if (dc === 'USD' && exchangeRate > 0) return p / exchangeRate;
    return p;
  };

  const convertedMonthly = subs.reduce((sum, s) => {
    if (!s.price) return sum;
    const p = toDisplay(s.price, s.currency);
    if (s.billingCycle === 'per month') return sum + p;
    if (s.billingCycle === 'per year') return sum + p / 12;
    return sum;
  }, 0);

  const convertedYearly = subs.reduce((sum, s) => {
    if (!s.price) return sum;
    const p = toDisplay(s.price, s.currency);
    if (s.billingCycle === 'per year') return sum + p;
    if (s.billingCycle === 'per month') return sum + p * 12;
    return sum;
  }, 0);

  // Bar chart data by billing cycle
  const byBilling = [
    { label: 'Monthly', count: subs.filter(s => s.billingCycle === 'per month').length, color: '#3b82f6' },
    { label: 'Yearly', count: subs.filter(s => s.billingCycle === 'per year').length, color: '#10b981' },
    { label: 'One-time', count: subs.filter(s => s.billingCycle === 'one time').length, color: '#8b5cf6' },
  ];
  const maxBar = Math.max(...byBilling.map(b => b.count), 1);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
      className="rounded-2xl border bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-violet-500" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Subscriptions & Licenses</h2>
            <p className="text-xs text-muted-foreground">{subs.length} total tracked</p>
          </div>
        </div>
        <button onClick={() => navigate('/subscriptions')}
          className="text-xs text-primary hover:underline flex items-center gap-1 transition-opacity hover:opacity-80">
          View all <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {subs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
          <CreditCard className="w-8 h-8 opacity-20" />
          No subscriptions tracked yet
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Active', value: active.length, color: '#10b981', bg: '#10b98115' },
              { label: 'Expiring Soon', value: expiringSoon.length, color: '#f59e0b', bg: '#f59e0b15' },
              { label: 'Expired', value: expired.length, color: '#f43f5e', bg: '#f43f5e15' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1 }}
                className="rounded-xl p-3 text-center" style={{ background: item.bg }}>
                <div className="text-2xl font-bold tabular-nums" style={{ color: item.color }}>{item.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Cost overview */}
          {showCosts && (
          <div className="rounded-xl bg-muted/40 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Est. Monthly Cost</div>
              <div className="text-xl font-bold">{formatCurrency(convertedMonthly.toFixed(0), displayCurrency)}</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-right">
              <div className="text-xs text-muted-foreground mb-0.5">Est. Yearly Cost</div>
              <div className="text-xl font-bold">{formatCurrency(convertedYearly.toFixed(0), displayCurrency)}</div>
            </div>
          </div>
          )}

          {/* Billing breakdown mini bar chart */}
          <div>
            <div className="text-xs text-muted-foreground mb-3 font-medium">By Billing Cycle</div>
            <div className="flex items-end gap-3 h-20">
              {byBilling.map((b, i) => {
                const pct = b.count / maxBar;
                const isH = hovered === i;
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5 flex-1"
                    onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                    <AnimatePresence>
                      {isH && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="text-xs font-bold px-2 py-0.5 rounded-md text-white"
                          style={{ background: b.color }}>
                          {b.count}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="relative w-full flex items-end" style={{ height: 60 }}>
                      <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(pct * 100, 6)}%` }}
                        transition={{ duration: 0.1 }}
                        className="w-full rounded-t-lg cursor-pointer"
                        style={{
                          background: isH ? b.color : b.color + '80',
                          boxShadow: isH ? `0 0 12px ${b.color}60` : 'none',
                          opacity: hovered !== null && !isH ? 0.4 : 1,
                          transition: 'background 0.2s, box-shadow 0.2s, opacity 0.2s',
                        }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expiring soon list */}
          {expiringSoon.length > 0 && (
            <div>
              <div className="text-xs text-amber-500 font-medium mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Manual renewals within {expiryWarningDays} day{expiryWarningDays === 1 ? '' : 's'}
              </div>
              {expiringSoon.slice(0, 3).map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1 }}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium truncate max-w-[140px]">{s.name}</span>
                  </div>
                  <span className="text-xs text-amber-500 font-medium">
                    {new Date(s.renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Database Storage Widget ───────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function DatabaseStorageWidget() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    clearAPI.getStorageStats()
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const FREE_TIER = 512 * 1024 * 1024;
  const used = stats?.storageSize || 0;
  const usedPct = Math.min((used / FREE_TIER) * 100, 100);
  const barColor = usedPct > 80 ? '#f43f5e' : usedPct > 50 ? '#f59e0b' : '#3b82f6';

  const collectionColors = {
    employees: '#3b82f6', assets: '#f59e0b', transfers: '#8b5cf6',
    asset_types: '#10b981', users: '#f43f5e', files: '#a855f7', subscriptions: '#06b6d4',
  };

  const collections = stats?.collections ? Object.entries(stats.collections) : [];
  const maxSize = Math.max(...collections.map(([, v]) => (typeof v === 'object' ? v.size : 0)), 1);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
      className="rounded-2xl border bg-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <HardDrive className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Database Storage</h2>
            <p className="text-xs text-muted-foreground">MongoDB Atlas · Free tier</p>
          </div>
        </div>
        <button onClick={() => navigate('/settings', { state: { section: 'clear-data' } })}
          className="text-xs text-primary hover:underline flex items-center gap-1">
          Manage <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !stats ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Could not load stats</div>
      ) : (
        <div className="space-y-5">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Actual Data', value: formatBytes(stats.dataSize), color: '#3b82f6' },
              { label: 'Allocated (Atlas)', value: formatBytes(stats.storageSize), color: barColor },
              { label: 'Records', value: stats.objects || 0, color: '#10b981' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1 }}
                className="rounded-xl bg-muted/40 p-3">
                <div className="text-base font-bold tabular-nums" style={{ color: item.color }}>{item.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Storage bar */}
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground font-medium">STORAGE (FREE TIER)</span>
              <span style={{ color: barColor }} className="font-semibold">{usedPct.toFixed(1)}% used</span>
            </div>
            <div className="w-full h-3 rounded-full bg-muted overflow-hidden mb-2">
              <motion.div className="h-full rounded-full" style={{ background: barColor }}
                initial={{ width: 0 }} animate={{ width: `${usedPct}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.6 }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatBytes(used)} used</span>
              <span>{formatBytes(Math.max(FREE_TIER - used, 0))} free of {formatBytes(FREE_TIER)}</span>
            </div>
          </div>

          {/* Per-collection mini bars */}
          <div>
            <div className="text-xs text-muted-foreground font-medium mb-3">By Collection</div>
            <div className="space-y-2">
              {collections.map(([key, val], i) => {
                const size = typeof val === 'object' ? val.size : 0;
                const count = typeof val === 'object' ? val.count : val;
                const pct = maxSize ? (size / maxSize) * 100 : 0;
                const color = collectionColors[key] || '#888';
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return (
                  <motion.div key={key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.1 }}
                    className="flex items-center gap-2">
                    <div className="w-20 text-xs text-muted-foreground truncate flex-shrink-0">{label}</div>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: color }}
                        initial={{ width: 0 }} animate={{ width: `${Math.max(pct, size > 0 ? 4 : 0)}%` }}
                        transition={{ duration: 0.1 }} />
                    </div>
                    <div className="text-xs tabular-nums text-muted-foreground w-14 text-right flex-shrink-0">
                      {formatBytes(size)}
                    </div>
                    <div className="text-xs tabular-nums text-muted-foreground w-10 text-right flex-shrink-0">
                      {count}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Super Admin Lock Card ────────────────────────────────────────────────────
function LockedWidget({ title, icon: Icon, color }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
      className="rounded-2xl border bg-card p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: color + '15' }}>
        <ShieldAlert className="w-6 h-6" style={{ color }} />
      </div>
      <div className="text-center">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-center">
          <Lock className="w-3 h-3" /> Login as Super Admin to view
        </div>
      </div>
    </motion.div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

// ── Asset Type Cards ─────────────────────────────────────────────────────────

function AssetTypeCards({ data, navigate }) {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { accentColor } = useTheme();
  const COLORS = ['#f43f5e','#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
  const CARDS_PER_PAGE = 4;
  const total = data.reduce((s, d) => s + (d.count || 0), 0);
  const pageCount = Math.ceil(data.length / CARDS_PER_PAGE);
  const needsScroll = data.length > CARDS_PER_PAGE;

  // Scroll to page when dot clicked
  const scrollToPage = (pageIdx) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.clientWidth / CARDS_PER_PAGE;
    el.scrollTo({ left: pageIdx * CARDS_PER_PAGE * (cardWidth + 16), behavior: 'smooth' });
    setActiveIndex(pageIdx);
  };

  // Update active dot on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const cardWidth = el.clientWidth / CARDS_PER_PAGE;
      const page = Math.round(el.scrollLeft / (CARDS_PER_PAGE * (cardWidth + 16)));
      setActiveIndex(Math.min(page, pageCount - 1));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pageCount]);

  const gridCols = data.length === 1 ? 'grid-cols-1' : data.length === 2 ? 'grid-cols-2' : data.length === 3 ? 'grid-cols-3' : 'grid-cols-4';

  const CardItem = ({ d, i }) => {
    const color = COLORS[i % COLORS.length];
    const pct = total ? Math.round((d.count / total) * 100) : 0;
    return (
      <div
        onClick={() => navigate('/assets')}
        className="rounded-2xl border border-border cursor-pointer overflow-hidden flex-shrink-0 group"
        style={{
          background: 'var(--card)',
          width: needsScroll ? 'calc((100% - 48px) / 4)' : undefined,
          transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = `0 12px 32px ${color}35`;
          e.currentTarget.style.borderColor = `${accentColor}60`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = '';
        }}
      >
        {/* Top color bar */}
        <div className="h-1.5 w-full" style={{ background: color }} />
        <div className="p-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}20` }}>
            <Package className="w-5 h-5" style={{ color }} />
          </div>
          <div className="font-semibold text-sm truncate mb-1 uppercase tracking-wide">{d.name}</div>
          <div className="text-3xl font-bold tabular-nums" style={{ color }}>{d.count || 0}</div>
          <div className="text-xs text-muted-foreground mt-0.5">assets</div>
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ background: color, width: `${pct}%`, transition: 'width 0.4s ease' }} />
          </div>
          <div className="text-xs text-muted-foreground mt-1">{pct}% of total</div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${accentColor}20` }}>
            <Package className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <h2 className="font-semibold text-base">Asset Types</h2>
          <span className="text-xs text-muted-foreground ml-1">{total} total</span>
        </div>

        {/* Dot indicators — only show when scrollable */}
        {needsScroll && (
          <div className="flex items-center gap-2">
            {/* Prev button */}
            <button
              onClick={() => scrollToPage(Math.max(0, activeIndex - 1))}
              disabled={activeIndex === 0}
              className="w-7 h-7 rounded-full flex items-center justify-center border transition-all"
              style={{
                borderColor: activeIndex === 0 ? 'rgba(128,128,128,0.2)' : accentColor,
                color: activeIndex === 0 ? 'rgba(128,128,128,0.4)' : accentColor,
                opacity: activeIndex === 0 ? 0.4 : 1,
              }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Dot pills */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToPage(i)}
                  style={{
                    width: i === activeIndex ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: i === activeIndex ? accentColor : 'rgba(128,128,128,0.25)',
                    transition: 'all 0.25s ease',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>

            {/* Next button */}
            <button
              onClick={() => scrollToPage(Math.min(pageCount - 1, activeIndex + 1))}
              disabled={activeIndex === pageCount - 1}
              className="w-7 h-7 rounded-full flex items-center justify-center border transition-all"
              style={{
                borderColor: activeIndex === pageCount - 1 ? 'rgba(128,128,128,0.2)' : accentColor,
                color: activeIndex === pageCount - 1 ? 'rgba(128,128,128,0.4)' : accentColor,
                opacity: activeIndex === pageCount - 1 ? 0.4 : 1,
              }}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Cards */}
      {needsScroll ? (
        <div className="overflow-hidden">
          <div
            ref={scrollRef}
            className="flex gap-4"
            style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style>{`.asset-scroll-hide::-webkit-scrollbar { display: none; }`}</style>
            {data.map((d, i) => <CardItem key={i} d={d} i={i} />)}
          </div>
        </div>
      ) : (
        <div className={`grid ${gridCols} gap-4`}>
          {data.map((d, i) => <CardItem key={i} d={d} i={i} />)}
        </div>
      )}

      {/* Bottom accent progress bar showing current position */}
      {needsScroll && (
        <div className="mt-4 h-0.5 rounded-full bg-muted overflow-hidden">
          <div
            style={{
              height: '100%',
              borderRadius: 9999,
              background: accentColor,
              width: `${((activeIndex + 1) / pageCount) * 100}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}
    </div>
  );
}


export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();

  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [showSubscriptionCosts, setShowSubscriptionCosts] = useState(true);
  const [showDbStorage, setShowDbStorage] = useState(true);
  const [expiryWarningDays, setExpiryWarningDays] = useState(30);
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [welcomeMessage, setWelcomeMessage] = useState('');

  useEffect(() => {
    async function fetchAll() {
      try {
        // Step 1: Load stats + settings first — small payloads, shows page fast
        const [statsRes, settingsRes] = await Promise.all([
          cachedAPI('dashboard-stats', () => dashboardAPI.getStats()),
          cachedAPI('app-settings', () => settingsAPI.getAppSettings()),
        ]);

        const appSettings = settingsRes.data || {};
        const chosenCurrency = appSettings.dashboardCurrency || 'USD';
        const transfersLimit = appSettings.recentTransfersCount || 5;

        setStats(statsRes.data);
        setDisplayCurrency(chosenCurrency);
        setShowSubscriptionCosts(appSettings.showSubscriptionCosts !== false);
        setShowDbStorage(appSettings.showDbStorage !== false);
        setExpiryWarningDays(appSettings.subscriptionWarningDays || 7);
        setRefreshInterval(appSettings.refreshInterval || 0);
        setWelcomeMessage(appSettings.welcomeMessage || '');

        // Show page immediately — don't wait for secondary data
        setLoading(false);

        // Step 2: Load secondary data in background (non-blocking)
        const [transfersRes, vehiclesRes, subsRes] = await Promise.all([
          cachedAPI('transfers', () => transfersAPI.getAll()).catch(() => ({ data: [] })),
          cachedAPI('vehicles', () => vehiclesAPI.getAll()).catch(() => ({ data: [] })),
          cachedAPI('subscriptions', () => subscriptionsAPI.getAll()).catch(() => ({ data: [] })),
        ]);

        setTransfers((transfersRes.data || []).slice(0, transfersLimit));
        setVehicles(vehiclesRes.data || []);
        setSubs(subsRes.data || []);

        // Step 3: Exchange rate — fire and forget, never blocks UI
        if (chosenCurrency !== 'USD') {
          fetch('https://api.exchangerate-api.com/v4/latest/USD')
            .then(r => r.json())
            .then(d => setExchangeRate(d.rates?.[chosenCurrency] || 1))
            .catch(() => setExchangeRate(1));
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;
    const id = setInterval(() => {
      dashboardAPI.getStats().then(r => setStats(r.data)).catch(() => {});
      subscriptionsAPI.getAll().then(r => setSubs(r.data || [])).catch(() => {});
    }, refreshInterval * 60 * 1000);
    return () => clearInterval(id);
  }, [refreshInterval]);

  if (loading) return <LoadingPage />;

  const assignedPct = stats?.totalAssets ? Math.round((stats.assignedAssets / stats.totalAssets) * 100) : 0;

  return (
    <div className="space-y-6 pb-8" data-testid="dashboard-page">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {welcomeMessage || (user?.name ? `Welcome back, ${user.name}. Here's your asset overview.` : "Here's your asset overview.")}
        </p>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Employees" value={stats?.totalEmployees || 0} icon={Users} color="#3b82f6" delay={0} onClick={() => navigate('/employees')} />
        <StatCard title="Total Assets" value={stats?.totalAssets || 0} icon={Package} color="#f43f5e" delay={0.06} onClick={() => navigate('/assets')} />
        <StatCard title="Assigned" value={stats?.assignedAssets || 0} icon={ArrowLeftRight} color="#10b981" delay={0.12} onClick={() => navigate('/assets')} subtitle={`${assignedPct}% of total`} />
        <StatCard title="In Inventory" value={stats?.inventoryAssets || 0} icon={Boxes} color="#f59e0b" delay={0.18} onClick={() => navigate('/inventory')} />
        <StatCard title="Disposed" value={stats?.disposedAssets || 0} icon={ArchiveX} color="#64748b" delay={0.22} onClick={() => navigate('/disposed-assets')} />
      </div>

      {/* Asset Type Cards - scrollable */}
      {stats?.assetsByType?.length > 0 && (
        <AssetTypeCards data={stats.assetsByType} navigate={navigate} />
      )}

      {/* Assignment Ring */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
        className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <h2 className="font-semibold text-base">Assignment Status</h2>
        </div>
        <AssignmentRing assigned={stats?.assignedAssets || 0} inventory={stats?.inventoryAssets || 0} total={stats?.totalAssets || 0} />
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-semibold text-base">Assets by Type</h2>
          </div>
          {stats?.assetsByType?.length > 0
            ? <DonutChart data={stats.assetsByType} />
            : <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No asset types yet</div>
          }
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-semibold text-base">Distribution</h2>
          </div>
          {stats?.assetsByType?.length > 0
            ? <BarChart data={stats.assetsByType} />
            : <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data yet</div>
          }
        </motion.div>
      </div>

      {/* Bottom row - transfers + vehicle fleet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <ArrowLeftRight className="w-4 h-4 text-primary" />
              </div>
              <h2 className="font-semibold text-base">Recent Transfers</h2>
            </div>
            <button onClick={() => navigate('/transfers')}
              className="text-xs text-primary hover:underline flex items-center gap-1 transition-opacity hover:opacity-80">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {transfers.length > 0
            ? transfers.map((t, i) => <TransferRow key={t.id || i} transfer={t} index={i} />)
            : <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No transfers yet</div>
          }
        </motion.div>

        <VehicleFleetWidget vehicles={vehicles} navigate={navigate} />
      </div>

      {/* New bottom row — Subscriptions + DB Storage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SubscriptionsWidget subs={subs} navigate={navigate} displayCurrency={displayCurrency} exchangeRate={exchangeRate} showCosts={showSubscriptionCosts} expiryWarningDays={expiryWarningDays} />
        {showDbStorage ? (isSuperAdmin
          ? <DatabaseStorageWidget />
          : <LockedWidget title="Database Storage" icon={HardDrive} color="#3b82f6" />
        ) : null}
      </div>
    </div>
  );
}
