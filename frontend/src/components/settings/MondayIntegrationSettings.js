import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, RefreshCw, Circle, TableProperties } from 'lucide-react';
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

export function MondayIntegrationSettings() {
  const [settings, setSettings] = useState({
    apiToken: '',
    boardId: '',
    syncEnabled: false,
    syncTime: '08:00',
    hasToken: false,
    lastSyncAt: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creatingStructure, setCreatingStructure] = useState(false);
  // gray = not configured, green = connected, red = failed
  const [connectionStatus, setConnectionStatus] = useState('gray');
  const [boardName, setBoardName] = useState('');

  const autoTest = useCallback(async () => {
    if (!settings.hasToken || !settings.boardId) {
      setConnectionStatus('gray');
      return;
    }
    
    setTesting(true);
    try {
      const response = await settingsAPI.testMonday();
      const result = response.data;
      if (result.status === 'connected') {
        setConnectionStatus('green');
        setBoardName(result.boardName || '');
      } else {
        setConnectionStatus('red');
      }
    } catch (error) {
      setConnectionStatus('red');
    } finally {
      setTesting(false);
    }
  }, [settings.hasToken, settings.boardId]);

  useEffect(() => {
    fetchSettings();
  }, []);

  // Auto-test when settings are loaded and configured
  useEffect(() => {
    if (!loading && settings.hasToken && settings.boardId) {
      autoTest();
    }
  }, [loading, autoTest, settings.hasToken, settings.boardId]);

  const fetchSettings = async () => {
    try {
      const response = await settingsAPI.getMonday();
      if (response.data) {
        setSettings(prev => ({ 
          ...prev, 
          ...response.data,
          // Keep existing token input if user entered one
          apiToken: response.data.apiToken || prev.apiToken
        }));
      }
    } catch (error) {
      toast.error('Failed to load Monday.com settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send token if it's a new one (not masked)
      const dataToSave = {
        boardId: settings.boardId,
        syncEnabled: settings.syncEnabled,
        syncTime: settings.syncTime
      };
      
      // Only include token if it's not the masked version
      if (settings.apiToken && !settings.apiToken.includes('...')) {
        dataToSave.apiToken = settings.apiToken;
      }
      
      const response = await settingsAPI.updateMonday(dataToSave);
      setSettings(prev => ({
        ...prev,
        ...response.data
      }));
      toast.success('Monday.com settings saved');
      // Re-test after saving
      setTimeout(autoTest, 500);
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleManualTest = async () => {
    setTesting(true);
    try {
      const response = await settingsAPI.testMonday();
      const result = response.data;
      if (result.status === 'connected') {
        setConnectionStatus('green');
        setBoardName(result.boardName || '');
        toast.success(`Connected to board: ${result.boardName || 'Unknown'}`);
      } else {
        setConnectionStatus('red');
        toast.error(`Connection failed: ${result.message}`);
      }
    } catch (error) {
      setConnectionStatus('red');
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleCreateStructure = async () => {
    setCreatingStructure(true);
    try {
      const response = await settingsAPI.createMondayStructure();
      if (response.data.success) {
        toast.success('Board structure created successfully');
      } else {
        toast.error(`Failed: ${response.data.message}`);
      }
    } catch (error) {
      toast.error('Failed to create board structure');
    } finally {
      setCreatingStructure(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await settingsAPI.syncMonday();
      if (response.data.success) {
        toast.success('Data synced to Monday.com successfully!');
        // Refresh settings to get updated lastSyncAt
        await fetchSettings();
      } else {
        toast.error(`Sync failed: ${response.data.message}`);
      }
    } catch (error) {
      toast.error('Failed to sync data');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = () => {
    if (testing) {
      return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
    }
    switch (connectionStatus) {
      case 'green':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'red':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (testing) return 'Testing...';
    switch (connectionStatus) {
      case 'green':
        return boardName ? `Connected: ${boardName}` : 'Connected';
      case 'red':
        return 'Not Connected';
      default:
        return 'Not Configured';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'green':
        return 'text-green-500';
      case 'red':
        return 'text-red-500';
      default:
        return 'text-gray-400';
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
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
                Monday.com Integration
              </CardTitle>
              <CardDescription>
                Sync employee and asset data to Monday.com dashboard
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
          {/* API Token */}
          <div className="space-y-2">
            <Label htmlFor="monday-token">API Token</Label>
            <Input
              id="monday-token"
              type="password"
              placeholder="Enter Monday.com API token"
              value={settings.apiToken}
              onChange={(e) => setSettings({ ...settings, apiToken: e.target.value })}
              data-testid="monday-token-input"
            />
            <p className="text-xs text-muted-foreground">
              Get your API token from Monday.com → Profile → Developers → API
            </p>
            {settings.hasToken && settings.apiToken.includes('...') && (
              <p className="text-xs text-green-600">
                ✓ Token saved. Enter new token to update.
              </p>
            )}
          </div>

          {/* Board ID */}
          <div className="space-y-2">
            <Label htmlFor="monday-board">Board ID</Label>
            <Input
              id="monday-board"
              placeholder="Enter Board ID"
              value={settings.boardId}
              onChange={(e) => setSettings({ ...settings, boardId: e.target.value })}
              data-testid="monday-board-input"
            />
            <p className="text-xs text-muted-foreground">
              Found in the board URL: monday.com/boards/<strong>[Board ID]</strong>
            </p>
          </div>

          {/* Enable Scheduled Sync + Schedule Widget */}
          <div className="py-3 border-y">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable Scheduled Sync</Label>
                <p className="text-sm text-muted-foreground">Automatically sync data daily</p>
              </div>
              <Switch
                checked={settings.syncEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, syncEnabled: checked })}
                data-testid="monday-sync-enabled-toggle"
              />
            </div>
            <SyncScheduleWidget
              syncEnabled={settings.syncEnabled}
              syncTime={settings.syncTime}
              onSyncTimeChange={(t) => setSettings({ ...settings, syncTime: t })}
              lastSyncAt={settings.lastSyncAt}
            />
          </div>


          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving} data-testid="save-monday-settings-btn">
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleManualTest} 
              disabled={testing || !settings.hasToken}
              data-testid="test-monday-connection-btn"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
          </div>

          {/* Create Structure & Sync Buttons - Only show when connected */}
          {connectionStatus === 'green' && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
              <Button 
                variant="outline"
                onClick={handleCreateStructure} 
                disabled={creatingStructure}
                data-testid="create-monday-structure-btn"
              >
                {creatingStructure ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <TableProperties className="w-4 h-4 mr-2" />
                    Create Board Structure
                  </>
                )}
              </Button>
              <Button 
                onClick={handleSync} 
                disabled={syncing}
                data-testid="sync-monday-btn"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
