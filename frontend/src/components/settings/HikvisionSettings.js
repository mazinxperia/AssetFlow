import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, Circle, Users, ShieldCheck, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { settingsAPI } from '../../services/api';
import { toast } from 'sonner';


// ── Reusable Sync Schedule Widget ──────────────────────────────────────────
function SyncScheduleWidget({ syncEnabled, syncTime, onSyncTimeChange, lastSyncAt }) {
  const [open, setOpen] = React.useState(false);
  const [now, setNow] = React.useState(new Date());

  // Tick every 30 seconds to update countdown
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Parse stored syncTime "HH:MM" → { hour, minute, ampm }
  const parseTime = (t) => {
    if (!t) return { hour: '08', minute: '00', ampm: 'AM' };
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 === 0 ? '12' : String(h % 12).padStart(2, '0');
    return { hour, minute: String(m).padStart(2, '0'), ampm };
  };

  const { hour, minute, ampm } = parseTime(syncTime);

  const toDisplay = () => {
    if (!syncTime) return 'Not set';
    return `${hour}:${minute} ${ampm}`;
  };

  // Calculate next sync datetime
  const getNextSync = () => {
    if (!syncTime) return null;
    const [h, m] = syncTime.split(':').map(Number);
    const next = new Date();
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  };

  const getMinsRemaining = () => {
    const next = getNextSync();
    if (!next) return null;
    const diff = Math.round((next - now) / 60000);
    if (diff < 60) return `${diff} min`;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  const handleTimeChange = (field, value) => {
    let h = hour, m = minute, ap = ampm;
    if (field === 'hour') h = value;
    if (field === 'minute') m = value;
    if (field === 'ampm') ap = value;
    // Convert to 24h "HH:MM"
    let h24 = parseInt(h);
    if (ap === 'AM' && h24 === 12) h24 = 0;
    if (ap === 'PM' && h24 !== 12) h24 += 12;
    onSyncTimeChange(`${String(h24).padStart(2, '0')}:${m}`);
  };

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  if (!syncEnabled) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors text-sm"
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Daily sync at <strong className="text-foreground">{toDisplay()}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          {syncTime && (
            <span className="text-xs text-primary font-medium">
              {getMinsRemaining()} away
            </span>
          )}
          <svg className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="mt-2 p-4 rounded-lg border border-border bg-card shadow-md space-y-4">
          {/* Current time display */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border">
            <span>Current time</span>
            <span className="font-mono font-medium text-foreground">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Time picker */}
          <div>
            <p className="text-xs font-medium mb-2">Sync time</p>
            <div className="flex items-center gap-2">
              {/* Hour */}
              <select
                value={hour}
                onChange={e => handleTimeChange('hour', e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-md border border-border bg-background text-sm font-mono text-center"
              >
                {hours.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-muted-foreground font-bold">:</span>
              {/* Minute */}
              <select
                value={minute}
                onChange={e => handleTimeChange('minute', e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-md border border-border bg-background text-sm font-mono text-center"
              >
                {minutes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {/* AM/PM */}
              <select
                value={ampm}
                onChange={e => handleTimeChange('ampm', e.target.value)}
                className="px-2 py-1.5 rounded-md border border-border bg-background text-sm text-center"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>

          {/* Next sync + countdown */}
          {syncTime && (
            <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
              <span className="text-muted-foreground">Next sync</span>
              <div className="text-right">
                <p className="font-medium text-foreground">{getNextSync()?.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {toDisplay()}</p>
                <p className="text-primary font-semibold">{getMinsRemaining()} remaining</p>
              </div>
            </div>
          )}

          {/* Last sync */}
          {lastSyncAt && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Last synced</span>
              <span>{new Date(lastSyncAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────

export function HikvisionSettings() {
  const [settings, setSettings] = useState({
    host: '',
    username: '',
    password: '',
    syncEnabled: false,
    syncTime: '08:00',
    hasPassword: false,
    lastSyncAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('gray');
  const [deviceName, setDeviceName] = useState('');
  const [syncResult, setSyncResult] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const autoTest = useCallback(async () => {
    if (!settings.host || (!settings.hasPassword && !settings.password)) {
      setConnectionStatus('gray');
      return;
    }
    setTesting(true);
    try {
      const response = await settingsAPI.testHikvision();
      const result = response.data;
      if (result.status === 'connected') {
        setConnectionStatus('green');
        setDeviceName(result.deviceName || '');
      } else {
        setConnectionStatus('red');
      }
    } catch {
      setConnectionStatus('red');
    } finally {
      setTesting(false);
    }
  }, [settings.host, settings.hasPassword, settings.password]);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!loading && settings.host && settings.hasPassword) {
      autoTest();
    }
  }, [loading, autoTest, settings.host, settings.hasPassword]);

  const fetchSettings = async () => {
    try {
      const response = await settingsAPI.getHikvision();
      if (response.data) {
        setSettings(prev => ({ ...prev, ...response.data }));
      }
    } catch {
      toast.error('Failed to load Hikvision settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dataToSave = {
        host: settings.host,
        username: settings.username,
        syncEnabled: settings.syncEnabled,
        syncTime: settings.syncTime,
      };
      if (settings.password && !settings.password.includes('...')) {
        dataToSave.password = settings.password;
      }
      const response = await settingsAPI.updateHikvision(dataToSave);
      setSettings(prev => ({ ...prev, ...response.data }));
      toast.success('Hikvision settings saved');
      setTimeout(autoTest, 500);
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleManualTest = async () => {
    setTesting(true);
    try {
      const response = await settingsAPI.testHikvision();
      const result = response.data;
      if (result.status === 'connected') {
        setConnectionStatus('green');
        setDeviceName(result.deviceName || '');
        toast.success(`Connected to: ${result.deviceName || 'Hikvision Device'}`);
      } else {
        setConnectionStatus('red');
        toast.error(`Connection failed: ${result.message}`);
      }
    } catch {
      setConnectionStatus('red');
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await settingsAPI.syncHikvision();
      const result = response.data;
      if (result.success) {
        setSyncResult(result);
        toast.success(`Sync complete! ${result.created} new employees added.`);
        await fetchSettings();
      } else {
        toast.error(`Sync failed: ${result.message}`);
      }
    } catch {
      toast.error('Failed to sync employees');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = () => {
    if (testing) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
    switch (connectionStatus) {
      case 'green': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'red':   return <XCircle className="w-5 h-5 text-red-500" />;
      default:      return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (testing) return 'Testing...';
    switch (connectionStatus) {
      case 'green': return deviceName ? `Connected: ${deviceName}` : 'Connected';
      case 'red':   return 'Not Connected';
      default:      return 'Not Configured';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'green': return 'text-green-500';
      case 'red':   return 'text-red-500';
      default:      return 'text-gray-400';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Hikvision Integration
              </CardTitle>
              <CardDescription>
                Pull employees from your Hikvision access control device
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Device Host */}
          <div className="space-y-2">
            <Label htmlFor="hik-host">Device IP / Host</Label>
            <Input
              id="hik-host"
              placeholder="e.g. 192.168.1.64"
              value={settings.host}
              onChange={(e) => setSettings({ ...settings, host: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Local IP address of your Hikvision DS-K1T342 device
            </p>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="hik-user">Username</Label>
            <Input
              id="hik-user"
              placeholder="admin"
              value={settings.username}
              onChange={(e) => setSettings({ ...settings, username: e.target.value })}
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="hik-pass">Password</Label>
            <Input
              id="hik-pass"
              type="password"
              placeholder="Enter device password"
              value={settings.password}
              onChange={(e) => setSettings({ ...settings, password: e.target.value })}
            />
            {settings.hasPassword && settings.password.includes('...') && (
              <p className="text-xs text-green-600">✓ Password saved. Enter new password to update.</p>
            )}
          </div>

          {/* Sync Result */}
          {syncResult && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 space-y-1">
              <p className="text-sm font-medium text-green-600">Sync Complete</p>
              <p className="text-xs text-muted-foreground">
                {syncResult.created} new employees added · {syncResult.skipped} already existed · {syncResult.withPhoto} photos saved
              </p>
            </div>
          )}

          {/* Scheduled Sync Toggle + Schedule Widget */}
          <div className="py-3 border-y">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable Scheduled Sync</Label>
                <p className="text-sm text-muted-foreground">Automatically sync employees daily</p>
              </div>
              <Switch
                checked={settings.syncEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, syncEnabled: checked })}
              />
            </div>
            <SyncScheduleWidget
              syncEnabled={settings.syncEnabled}
              syncTime={settings.syncTime}
              onSyncTimeChange={(t) => setSettings({ ...settings, syncTime: t })}
              lastSyncAt={settings.lastSyncAt}
            />
          </div>

          {/* Save + Test */}
          <div className="flex flex-wrap gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button
              variant="outline"
              onClick={handleManualTest}
              disabled={testing || (!settings.hasPassword && !settings.password)}
            >
              {testing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing...</>
              ) : 'Test Connection'}
            </Button>
          </div>

          {/* Sync Now - only when connected */}
          {connectionStatus === 'green' && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Syncing Employees...</>
                ) : (
                  <><Users className="w-4 h-4 mr-2" />Sync Employees Now</>
                )}
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
      {/* Setup Notes */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <button
          onClick={() => setNotesOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="w-4 h-4" />
            <span className="text-sm font-medium">Setup & Deployment Notes</span>
          </div>
          {notesOpen
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {notesOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4 bg-muted/10">
            <p className="text-xs text-muted-foreground">
              The Hikvision integration requires <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">httpx</code> to
              be installed on your backend. Make sure to run this before deploying.
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium mb-1.5">1. Local development</p>
                <pre className="bg-black/40 text-green-400 text-xs font-mono rounded-md px-3 py-2.5 overflow-x-auto">
                  pip install httpx --break-system-packages
                </pre>
              </div>

              <div>
                <p className="text-xs font-medium mb-1.5">2. Add to <code className="bg-muted px-1 py-0.5 rounded font-mono">requirements.txt</code> (for deployment)</p>
                <pre className="bg-black/40 text-green-400 text-xs font-mono rounded-md px-3 py-2.5 overflow-x-auto">
                  httpx
                </pre>
                <p className="text-xs text-muted-foreground mt-1">
                  Open your <code className="bg-muted px-1 py-0.5 rounded font-mono">backend/requirements.txt</code> and add <code className="bg-muted px-1 py-0.5 rounded font-mono">httpx</code> on a new line.
                </p>
              </div>

              <div>
                <p className="text-xs font-medium mb-1.5">3. Railway / Vercel / Docker deploy</p>
                <p className="text-xs text-muted-foreground">
                  If you're deploying to Railway, it reads <code className="bg-muted px-1 py-0.5 rounded font-mono">requirements.txt</code> automatically.
                  Just make sure <code className="bg-muted px-1 py-0.5 rounded font-mono">httpx</code> is in the file and redeploy — no manual steps needed.
                </p>
              </div>

              <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">⚠ Network requirement</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your backend server must be on the <strong>same local network</strong> as the Hikvision device.
                  This won't work if your backend is hosted on a cloud server and the device is only on your office LAN —
                  in that case, run the backend locally or use a VPN/tunnel.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

    </motion.div>
  );
}
