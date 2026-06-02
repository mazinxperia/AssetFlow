import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, DollarSign, Eye, RefreshCw, Clock, Calendar, Users, MessageSquare, Filter, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { settingsAPI } from '../../services/api';
import { toast } from 'sonner';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

const EMPLOYEE_SORT_OPTIONS = [
  { value: 'employeeId-asc', label: 'Employee ID (Ascending)' },
  { value: 'employeeId-desc', label: 'Employee ID (Descending)' },
  { value: 'name-asc', label: 'Name (A → Z)' },
  { value: 'name-desc', label: 'Name (Z → A)' },
  { value: 'assets-asc', label: 'Assets Assigned (Low to High)' },
  { value: 'assets-desc', label: 'Assets Assigned (High to Low)' },
];

function ToggleRow({ label, desc, value, onChange }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border">
      <div className="space-y-0.5">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Icon className="w-5 h-5" />
        {title}
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  );
}

export function DashboardSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rate, setRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(false);

  // Settings state
  const [currency, setCurrency] = useState('USD');
  const [showSubscriptionCosts, setShowSubscriptionCosts] = useState(true);
  const [showDbStorage, setShowDbStorage] = useState(true);
  const [dateFormat, setDateFormat] = useState('MMM DD, YYYY');
  const [expiryWarningDays, setExpiryWarningDays] = useState('30');
  const [refreshInterval, setRefreshInterval] = useState('0');
  const [topEmployeesCount, setTopEmployeesCount] = useState('5');
  const [recentTransfersCount, setRecentTransfersCount] = useState('5');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [defaultAssetFilter, setDefaultAssetFilter] = useState('all');
  const [dashboardEmployeeSort, setDashboardEmployeeSort] = useState('assets-desc');

  useEffect(() => { fetchSettings(); }, []);
  useEffect(() => {
    if (currency && currency !== 'USD') fetchRate(currency);
    else setRate(null);
  }, [currency]);

  const fetchSettings = async () => {
    try {
      const res = await settingsAPI.getAppSettings();
      const d = res.data || {};
      setCurrency(d.dashboardCurrency || 'USD');
      setShowSubscriptionCosts(d.showSubscriptionCosts !== false);
      setShowDbStorage(d.showDbStorage !== false);
      setDateFormat(d.dateFormat || 'MMM DD, YYYY');
      setExpiryWarningDays(String(d.expiryWarningDays || 30));
      setRefreshInterval(String(d.refreshInterval || 0));
      setTopEmployeesCount(String(d.topEmployeesCount || 5));
      setRecentTransfersCount(String(d.recentTransfersCount || 5));
      setWelcomeMessage(d.welcomeMessage || '');
      setDefaultAssetFilter(d.defaultAssetFilter || 'all');
      setDashboardEmployeeSort(d.dashboardEmployeeSort || 'assets-desc');
    } catch {}
    finally { setLoading(false); }
  };

  const fetchRate = async (toCurrency) => {
    setRateLoading(true);
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await res.json();
      const r = data.rates?.[toCurrency];
      setRate(r ? { rate: r, to: toCurrency } : null);
    } catch { setRate(null); }
    finally { setRateLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateAppSettings({
        dashboardCurrency: currency,
        showSubscriptionCosts,
        showDbStorage,
        dateFormat,
        expiryWarningDays: parseInt(expiryWarningDays) || 30,
        refreshInterval: parseInt(refreshInterval) || 0,
        topEmployeesCount: parseInt(topEmployeesCount) || 5,
        recentTransfersCount: parseInt(recentTransfersCount) || 5,
        welcomeMessage,
        defaultAssetFilter,
        dashboardEmployeeSort,
      });
      toast.success('Dashboard settings saved');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );

  const selectedCurrency = CURRENCIES.find(c => c.code === currency);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* 1. Currency */}
      <Card>
        <SectionHeader icon={DollarSign} title="Display Currency"
          description="Subscription prices on the dashboard will be converted and shown in this currency" />
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Dashboard Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="font-medium">{c.code}</span>
                    <span className="text-muted-foreground ml-2 text-sm">{c.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {currency !== 'USD' && (
            <div className="rounded-xl bg-muted/40 border border-border p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Live Exchange Rate</span>
                <button onClick={() => fetchRate(currency)} disabled={rateLoading}
                  className="text-xs text-primary flex items-center gap-1 hover:underline">
                  <RefreshCw className={`w-3 h-3 ${rateLoading ? 'animate-spin' : ''}`} />Refresh
                </button>
              </div>
              {rateLoading ? (
                <div className="text-sm text-muted-foreground">Fetching rate...</div>
              ) : rate ? (
                <div className="text-sm">
                  <span className="text-muted-foreground">1 USD = </span>
                  <span className="font-bold text-primary">{rate.rate.toFixed(4)} {currency}</span>
                  <div className="text-xs text-muted-foreground mt-1">
                    Example: $100 USD = {selectedCurrency?.symbol}{(100 * rate.rate).toFixed(0)} {currency}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Could not fetch rate. Prices will show as-is.</div>
              )}
            </div>
          )}
          {currency === 'USD' && (
            <p className="text-sm text-muted-foreground">Prices will be shown in original USD without conversion.</p>
          )}
        </CardContent>
      </Card>

      {/* 2. Date Format */}
      <Card>
        <SectionHeader icon={Calendar} title="Date Format"
          description="How dates are displayed across the dashboard" />
        <CardContent>
          <Select value={dateFormat} onValueChange={setDateFormat}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MMM DD, YYYY">Jan 23, 2025</SelectItem>
              <SelectItem value="DD/MM/YYYY">23/01/2025</SelectItem>
              <SelectItem value="MM/DD/YYYY">01/23/2025</SelectItem>
              <SelectItem value="YYYY-MM-DD">2025-01-23</SelectItem>
              <SelectItem value="DD MMM YYYY">23 Jan 2025</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 3. Subscription Expiry Warning */}
      <Card>
        <SectionHeader icon={Clock} title="Expiry Warning Threshold"
          description="Show 'expiring soon' warning this many days before renewal date" />
        <CardContent>
          <Select value={expiryWarningDays} onValueChange={setExpiryWarningDays}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 4. Auto Refresh */}
      <Card>
        <SectionHeader icon={RefreshCw} title="Auto Refresh"
          description="Automatically refresh dashboard data in the background" />
        <CardContent>
          <Select value={refreshInterval} onValueChange={setRefreshInterval}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Off</SelectItem>
              <SelectItem value="5">Every 5 minutes</SelectItem>
              <SelectItem value="10">Every 10 minutes</SelectItem>
              <SelectItem value="30">Every 30 minutes</SelectItem>
              <SelectItem value="60">Every hour</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 5. List Counts */}
      <Card>
        <SectionHeader icon={Users} title="List Counts"
          description="How many items to show in dashboard lists" />
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Top Employees to Show</Label>
              <Select value={topEmployeesCount} onValueChange={setTopEmployeesCount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 employees</SelectItem>
                  <SelectItem value="5">5 employees</SelectItem>
                  <SelectItem value="10">10 employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recent Transfers to Show</Label>
              <Select value={recentTransfersCount} onValueChange={setRecentTransfersCount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 transfers</SelectItem>
                  <SelectItem value="5">5 transfers</SelectItem>
                  <SelectItem value="10">10 transfers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. Employee Sort Order (NEW) */}
      <Card>
        <SectionHeader icon={ArrowUpDown} title="Dashboard Employee Sort"
          description="How employees are sorted in the 'Employees by Assets' widget on the dashboard" />
        <CardContent>
          <Select value={dashboardEmployeeSort} onValueChange={setDashboardEmployeeSort}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EMPLOYEE_SORT_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 7. Default Asset Filter */}
      <Card>
        <SectionHeader icon={Filter} title="Default Asset Filter"
          description="Which filter is applied when you open the Assets page" />
        <CardContent>
          <Select value={defaultAssetFilter} onValueChange={setDefaultAssetFilter}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assets</SelectItem>
              <SelectItem value="assigned">Assigned Only</SelectItem>
              <SelectItem value="inventory">Inventory Only</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 8. Welcome Message */}
      <Card>
        <SectionHeader icon={MessageSquare} title="Welcome Message"
          description="Custom message shown under the Dashboard heading. Leave blank for default." />
        <CardContent>
          <Input
            placeholder="e.g. Good morning team! Here's your daily asset overview."
            value={welcomeMessage}
            onChange={e => setWelcomeMessage(e.target.value)}
            className="max-w-lg"
          />
        </CardContent>
      </Card>

      {/* 9. Widget Visibility */}
      <Card>
        <SectionHeader icon={Eye} title="Widget Visibility"
          description="Choose which widgets appear on the dashboard" />
        <CardContent className="space-y-3">
          <ToggleRow label="Subscription Costs" desc="Show estimated monthly/yearly cost on the subscriptions widget"
            value={showSubscriptionCosts} onChange={setShowSubscriptionCosts} />
          <ToggleRow label="Database Storage Widget" desc="Show database storage usage widget (Super Admin only)"
            value={showDbStorage} onChange={setShowDbStorage} />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[140px]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

    </motion.div>
  );
}
