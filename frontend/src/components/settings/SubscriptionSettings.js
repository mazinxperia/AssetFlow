import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { settingsAPI } from '../../services/api';
import { invalidateCache } from '../../services/apiCache';
import { toast } from 'sonner';

const WARNING_OPTIONS = [
  { value: '1', label: '1 day before' },
  { value: '2', label: '2 days before' },
  { value: '3', label: '3 days before' },
  { value: '4', label: '4 days before' },
  { value: '5', label: '5 days before' },
  { value: '6', label: '6 days before' },
  { value: '7', label: '1 week before' },
];

export function SubscriptionSettings() {
  const [warningDays, setWarningDays] = useState('7');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await settingsAPI.getAppSettings();
        setWarningDays(String(response.data?.subscriptionWarningDays || 7));
      } catch {
        toast.error('Failed to load subscription settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateAppSettings({ subscriptionWarningDays: Number(warningDays) });
      invalidateCache(['app-settings', 'subscriptions', 'dashboard-stats']);
      toast.success('Subscription settings saved');
    } catch {
      toast.error('Failed to save subscription settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Subscription Settings
          </CardTitle>
          <CardDescription>
            Manual-pay subscriptions will be marked due soon using this threshold. Auto-pay subscriptions renew automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Manual Renewal Warning</Label>
            <Select value={warningDays} onValueChange={setWarningDays}>
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WARNING_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              This applies to both the dashboard subscription widget and the subscriptions page.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
