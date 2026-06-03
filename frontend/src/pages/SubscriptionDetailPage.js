import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Edit, Trash2, CreditCard, Eye, EyeOff,
  Globe, ExternalLink, Users, Calendar,
  DollarSign, AlertTriangle, CheckCircle2, Lock, Loader2, RotateCw
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingPage } from '../components/common/LoadingSpinner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { subscriptionsAPI, employeesAPI, filesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const CURRENCIES = ['USD', 'AED', 'EUR', 'GBP', 'SAR', 'INR', 'CAD', 'AUD'];
const BILLING_CYCLES = ['per month', 'per year', 'one time'];
const PAYMENT_METHODS = ['Credit Card', 'Bank Transfer', 'PO'];

function formatCurrency(amount, currency) {
  if (!amount) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0 }).format(amount);
  } catch { return `${currency} ${amount}`; }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

function RevealField({ label, value, icon: Icon }) {
  const [visible, setVisible] = useState(false);
  if (!value) return (
    <div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-muted-foreground">—</p>
    </div>
  );
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{visible ? value : '••••••••••••'}</span>
        <button onClick={() => setVisible(v => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted">
          {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function InfoField({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className={cn("font-medium", mono && "font-mono text-sm")}>{value || '—'}</p>
    </div>
  );
}

function EmployeeMultiSelect({ employees, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.employeeId.toLowerCase().includes(search.toLowerCase())
  );
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter(i => i !== id) : [...selected, id]);
  const selectedNames = employees.filter(e => selected.includes(e.id)).map(e => e.name);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-background text-sm hover:bg-muted/40 transition-colors">
        <span className={selected.length === 0 ? 'text-muted-foreground' : ''}>
          {selected.length === 0 ? 'Select employees...' : selectedNames.join(', ')}
        </span>
        <span className="text-muted-foreground text-xs">{selected.length > 0 ? `${selected.length} selected` : ''}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <input autoFocus placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-muted/50 rounded-md border-0 outline-none" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(e => (
              <label key={e.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer">
                <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} className="rounded accent-primary" />
                <span className="text-sm flex-1">{e.name}</span>
                <span className="text-xs text-muted-foreground">{e.employeeId}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EditDialog({ open, onClose, onSaved, sub, employees }) {
  const empty = {
    name: '', username: '', password: '', link: '', price: '',
    currency: 'USD', billingCycle: 'per year', assignedEmployeeIds: [],
    department: '', renewalDate: '', autopay: 'manual', paymentMethod: 'Credit Card', notes: '',
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [fetchingLogo, setFetchingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);

  const fetchLogo = async (url) => {
    if (!url) { toast.error('Please enter a URL first'); return; }
    setFetchingLogo(true);
    try {
      const res = await subscriptionsAPI.fetchLogo(url);
      const fileId = res.data.fileId;
      setForm(f => ({ ...f, logoFileId: fileId }));
      setLogoPreview(filesAPI.getUrl(fileId));
      toast.success('Logo fetched!');
    } catch (e) {
      toast.error('Failed to fetch logo. Try a different URL.');
    } finally {
      setFetchingLogo(false);
    }
  };

  useEffect(() => {
    if (open && sub) {
      setForm({ ...empty, ...sub });
      setLogoPreview(sub.logoFileId ? filesAPI.getUrl(sub.logoFileId) : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sub]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      await subscriptionsAPI.update(sub.id, form);
      toast.success('Subscription updated');
      onSaved(); onClose();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const cls = "bg-background border-border";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Subscription</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Name *</label>
            <Input className={cls} value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Username / Email</label>
            <Input className={cls} value={form.username} onChange={e => set('username', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Password</label>
            <Input className={cls} value={form.password} onChange={e => set('password', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Link / URL</label>
            <div className="flex gap-2">
              <Input className={cls} value={form.link} onChange={e => set('link', e.target.value)} />
              <Button type="button" variant="outline" onClick={() => fetchLogo(form.link)} disabled={fetchingLogo || !form.link} className="flex-shrink-0">
                {fetchingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch Logo'}
              </Button>
            </div>
            {(logoPreview || form.logoFileId) && (
              <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center overflow-hidden">
                  <img
                    src={logoPreview || filesAPI.getUrl(form.logoFileId)}
                    alt="Logo"
                    className="w-full h-full object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Logo</p>
                  <p className="text-xs text-muted-foreground">Shown in subscription list and detail page</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setLogoPreview(null); setForm(f => ({ ...f, logoFileId: null })); }}>
                  Remove
                </Button>
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Price</label>
            <div className="flex gap-2">
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger className="w-24 flex-shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Input className={cls} type="number" value={form.price} onChange={e => set('price', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Billing Cycle</label>
            <Select value={form.billingCycle} onValueChange={v => set('billingCycle', v)}>
              <SelectTrigger className={cls}><SelectValue /></SelectTrigger>
              <SelectContent>{BILLING_CYCLES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Assigned Employees</label>
            <EmployeeMultiSelect employees={employees} selected={form.assignedEmployeeIds || []} onChange={ids => set('assignedEmployeeIds', ids)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Department</label>
            <Input className={cls} value={form.department} onChange={e => set('department', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Renewal / Expiry Date</label>
            <Input className={cls} type="date" value={form.renewalDate ? form.renewalDate.split('T')[0] : ''} onChange={e => set('renewalDate', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Payment Type</label>
            <Select value={form.autopay} onValueChange={v => set('autopay', v)}>
              <SelectTrigger className={cls}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto Pay</SelectItem>
                <SelectItem value="manual">Manual Pay</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Payment Method</label>
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => set('paymentMethod', m)}
                  className={cn("px-4 py-2 rounded-lg text-sm border transition-all",
                    form.paymentMethod === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Notes</label>
            <Input className={cls} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SubscriptionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isReadOnly } = useAuth();
  const [sub, setSub] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [subRes, empRes] = await Promise.all([
        subscriptionsAPI.getById(id),
        employeesAPI.getAll(),
      ]);
      setSub(subRes.data);
      setEmployees(empRes.data);
    } catch {
      toast.error('Failed to load subscription');
      navigate('/subscriptions');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    try {
      await subscriptionsAPI.delete(id);
      toast.success('Subscription deleted');
      navigate('/subscriptions');
    } catch { toast.error('Failed to delete'); }
  };

  const handleRenew = async () => {
    try {
      const response = await subscriptionsAPI.renew(id);
      setSub(response.data);
      toast.success('Subscription renewed');
    } catch {
      toast.error('Failed to renew subscription');
    }
  };

  if (loading) return <LoadingPage />;
  if (!sub) return null;

  const assignedIds = sub.assignedEmployeeIds || (sub.assignedEmployeeId ? [sub.assignedEmployeeId] : []);
  const assignedEmployees = employees.filter(e => assignedIds.includes(e.id));
  const expired = sub.renewalStatus === 'expired';
  const expiring = sub.renewalStatus === 'expiring_soon';
  const autoRenewing = sub.renewalStatus === 'auto_renewing';
  const days = sub.daysUntilRenewal ?? daysUntil(sub.renewalDate);

  const statusColor = expired ? 'text-destructive' : expiring ? 'text-amber-500' : 'text-green-500';
  const statusLabel = sub.renewalStatusLabel || (autoRenewing ? 'Auto-renewing' : 'Active');
  const StatusIcon = expired || expiring ? AlertTriangle : CheckCircle2;

  return (
    <div>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            {sub.logoFileId ? (
              <img
                src={filesAPI.getUrl(sub.logoFileId)}
                alt={sub.name}
                className="w-10 h-10 object-contain flex-shrink-0"
                onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
              />
            ) : null}
            <span>{sub.name}</span>
          </div>
        }
        description={sub.department || 'Subscription & License'}
        actions={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/subscriptions')}>
              <ArrowLeft className="w-4 h-4 mr-2" />Back
            </Button>
            {!isReadOnly && (
              <>
                {sub.needsManualRenewal && (
                  <Button variant="outline" onClick={handleRenew}>
                    <RotateCw className="w-4 h-4 mr-2" />Mark Renewed
                  </Button>
                )}
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Edit className="w-4 h-4 mr-2" />Edit
                </Button>
                <Button variant="outline" className="text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />Delete
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — Main details */}
        <div className="lg:col-span-2 space-y-6">

          {/* Subscription Details */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="dark:border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />Subscription Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <InfoField label="Subscription Name" value={sub.name} />
                  <InfoField label="Department" value={sub.department} />
                  <InfoField label="Billing Cycle" value={sub.billingCycle} />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                    <div className="flex items-center gap-2">
                      {sub.paymentMethod && <Badge variant="outline">{sub.paymentMethod}</Badge>}
                      {sub.autopay === 'auto' && <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Auto Pay</Badge>}
                      {sub.autopay === 'manual' && <Badge variant="secondary">Manual</Badge>}
                    </div>
                  </div>
                  {sub.notes && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{sub.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Login Credentials */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="dark:border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="w-4 h-4" />Login Credentials
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <InfoField label="Username / Email" value={sub.username} mono />
                  <RevealField label="Password" value={sub.password} />
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">Link / URL</p>
                    {sub.link ? (
                      <a href={sub.link.startsWith('http') ? sub.link : `https://${sub.link}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:underline text-sm font-medium">
                        <Globe className="w-4 h-4" />
                        {sub.link}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : <p className="text-muted-foreground">—</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Assigned Employees */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="dark:border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Assigned Employees
                  {assignedEmployees.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{assignedEmployees.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignedEmployees.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No employees assigned</p>
                ) : (
                  <div className="space-y-3">
                    {assignedEmployees.map(emp => (
                      <div key={emp.id}
                        onClick={() => navigate(`/employees/${emp.id}`)}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/40 cursor-pointer transition-colors">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                            {emp.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.employeeId} {emp.department ? `· ${emp.department}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* RIGHT — Sidebar */}
        <div className="space-y-6">

          {/* Status card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="dark:border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center",
                    expired ? "bg-destructive/10" : expiring ? "bg-amber-500/10" : "bg-green-500/10")}>
                    <StatusIcon className={cn("w-5 h-5", statusColor)} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className={cn("font-semibold", statusColor)}>{statusLabel}</p>
                  </div>
                </div>
                {days !== null && (
                  <p className="text-xs text-muted-foreground">
                    {autoRenewing
                      ? (days === 0 ? 'Auto-renews today' : `Auto-renews in ${days} day${days === 1 ? '' : 's'}`)
                      : days < 0
                        ? `Renewal overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
                        : days === 0
                          ? 'Renewal is due today'
                          : `${days} day${days === 1 ? '' : 's'} remaining`}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Pricing */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="dark:border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Price</p>
                  <p className="text-2xl font-bold">{formatCurrency(sub.price, sub.currency)}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{sub.billingCycle}</p>
                </div>
                {sub.price && sub.billingCycle === 'per month' && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-1">Est. Yearly</p>
                    <p className="font-semibold">{formatCurrency(parseFloat(sub.price) * 12, sub.currency)}</p>
                  </div>
                )}
                {sub.price && sub.billingCycle === 'per year' && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-1">Est. Monthly</p>
                    <p className="font-semibold">{formatCurrency(parseFloat(sub.price) / 12, sub.currency)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Renewal */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="dark:border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />Renewal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Next Renewal / Expiry</p>
                  <p className={cn("font-semibold", expired && "text-destructive", expiring && !expired && "text-amber-500")}>
                    {formatDate(sub.renewalDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Renewal Status</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      autoRenewing && "border-green-500/30 text-green-600 bg-green-500/10",
                      expiring && "border-amber-500/30 text-amber-600 bg-amber-500/10",
                      expired && "border-destructive/30 text-destructive bg-destructive/10"
                    )}
                  >
                    {statusLabel}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Auto Pay</p>
                  <Badge variant={sub.autopay === 'auto' ? 'default' : 'secondary'}>
                    {sub.autopay === 'auto' ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                {sub.needsManualRenewal && !isReadOnly && (
                  <Button className="w-full" onClick={handleRenew}>
                    <RotateCw className="w-4 h-4 mr-2" />Mark Renewed
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>

        </div>
      </div>

      <EditDialog open={editOpen} onClose={() => setEditOpen(false)} onSaved={fetchData} sub={sub} employees={employees} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{sub.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
