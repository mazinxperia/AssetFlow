import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Edit, Trash2, CreditCard, Eye,
  AlertTriangle, CheckCircle2, ChevronDown, Save, Loader2
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingPage } from '../components/common/LoadingSpinner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { subscriptionsAPI, employeesAPI, filesAPI } from '../services/api';
import { cachedAPI, invalidateCache } from '../services/apiCache';
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
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false;
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 30;
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
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {selected.length > 0 && <p className="text-xs text-muted-foreground mt-1">{selected.length} employee(s) selected</p>}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input autoFocus placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 rounded-md border-0 outline-none placeholder:text-muted-foreground" />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0
                ? <div className="px-3 py-3 text-sm text-muted-foreground text-center">No employees found</div>
                : filtered.map(e => {
                    const checked = selected.includes(e.id);
                    return (
                      <label key={e.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => toggle(e.id)} className="rounded accent-primary" />
                        <span className="text-sm flex-1">{e.name}</span>
                        <span className="text-xs text-muted-foreground">{e.employeeId}</span>
                      </label>
                    );
                  })}
            </div>
            {selected.length > 0 && (
              <div className="p-2 border-t border-border">
                <button onClick={() => onChange([])} className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1">Clear all</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubscriptionFormDialog({ open, onClose, onSaved, initial, employees }) {
  const isEdit = !!initial;
  const empty = useMemo(() => ({
    name: '', username: '', password: '', link: '', price: '',
    currency: 'USD', billingCycle: 'per year', assignedEmployeeIds: [],
    department: '', renewalDate: '', autopay: 'manual', paymentMethod: 'Credit Card', notes: '',
    logoFileId: null,
  }), []);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [fetchingLogo, setFetchingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);

  const fetchLogo = useCallback(async (url) => {
    if (!url) {
      toast.error('Please enter a URL first');
      return;
    }
    setFetchingLogo(true);
    try {
      const res = await subscriptionsAPI.fetchLogo(url);
      const fileId = res.data.fileId;
      setForm(f => ({ ...f, logoFileId: fileId }));
      setLogoPreview(filesAPI.getUrl(fileId));
      toast.success('Logo fetched successfully!');
    } catch (e) {
      console.error('Failed to fetch logo:', e);
      toast.error('Failed to fetch logo. Try a different URL.');
    } finally {
      setFetchingLogo(false);
    }
  }, []);

  // Fetch logo when link changes (debounced) — only on ADD, not edit
  useEffect(() => {
    if (!form.link || isEdit) return;
    const timer = setTimeout(() => {
      if (form.link && !form.logoFileId && !logoPreview) {
        fetchLogo(form.link);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [fetchLogo, form.link, form.logoFileId, isEdit, logoPreview]);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...empty, ...initial } : empty);
      setLogoPreview(initial?.logoFileId ? filesAPI.getUrl(initial.logoFileId) : null);
    }
  }, [empty, open, initial]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Subscription name is required'); return; }
    setSaving(true);
    try {
      const dataToSave = { ...form };
      // Ensure link has protocol
      if (dataToSave.link && !dataToSave.link.startsWith('http')) {
        dataToSave.link = 'https://' + dataToSave.link;
      }
      if (isEdit) { await subscriptionsAPI.update(initial.id, dataToSave); toast.success('Subscription updated'); }
      else { await subscriptionsAPI.create(dataToSave); toast.success('Subscription added'); }
      onSaved(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const cls = "bg-background border-border";

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Subscription' : 'Add Subscription / License'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Subscription / License Name *</label>
            <Input className={cls} placeholder="e.g. Adobe Creative Cloud" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Username / Email</label>
            <Input className={cls} placeholder="login@company.com" value={form.username} onChange={e => set('username', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Password</label>
            <Input className={cls} placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Link / URL</label>
            <div className="flex gap-2">
              <Input className={cls} placeholder="https://..." value={form.link} onChange={e => set('link', e.target.value)} />
              <Button
                type="button"
                variant="outline"
                onClick={() => fetchLogo(form.link)}
                disabled={fetchingLogo || !form.link}
                className="flex-shrink-0"
              >
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
                  <p className="text-sm font-medium">Logo fetched</p>
                  <p className="text-xs text-muted-foreground">This will appear in the subscription list</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setLogoPreview(null); setForm(f => ({ ...f, logoFileId: null })); }}
                >
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
              <Input className={cls} type="number" placeholder="0.00" value={form.price} onChange={e => set('price', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Billing Cycle</label>
            <Select value={form.billingCycle} onValueChange={v => {
              set('billingCycle', v);
              if (!form.renewalDate && v !== 'one time') {
                const d = new Date();
                if (v === 'per month') d.setMonth(d.getMonth() + 1);
                if (v === 'per year') d.setFullYear(d.getFullYear() + 1);
                set('renewalDate', d.toISOString().split('T')[0]);
              }
            }}>
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
            <Input className={cls} placeholder="e.g. Engineering" value={form.department} onChange={e => set('department', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Next Renewal / Expiry Date</label>
            <Input className={cls} type="date" value={form.renewalDate} onChange={e => set('renewalDate', e.target.value)} />
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
            <Input className={cls} placeholder="Any additional notes..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Save Changes' : 'Add Subscription'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubTable({ items, title, variant, onEdit, onDelete, onView, isReadOnly }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden shadow-sm", variant === 'expired' && "border-destructive/30")}>
      <button className={cn("w-full flex items-center gap-3 px-6 py-4 border-b border-border hover:bg-muted/20 transition-colors",
        variant === 'expired' && "bg-destructive/5")}
        onClick={() => setCollapsed(c => !c)}>
        {variant === 'expired'
          ? <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          : <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
        <span className="font-semibold text-base flex-1 text-left">{title}</span>
        <Badge variant={variant === 'expired' ? 'destructive' : 'secondary'} className="text-xs">{items.length}</Badge>
        <motion.div animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground ml-2" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div key="content" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }} style={{ overflow: 'hidden' }}>
            {items.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No subscriptions here</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-3">Subscription</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-3">Price</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-3">Employees</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-3">Renewal / Expiry</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((sub, i) => {
                    const expiring = isExpiringSoon(sub.renewalDate);
                    const expired = isExpired(sub.renewalDate);
                    const ids = sub.assignedEmployeeIds || (sub.assignedEmployeeId ? [sub.assignedEmployeeId] : []);
                    const empCount = ids.length;

                    return (
                      <motion.tr key={sub.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        onClick={() => onView(sub)}
                        className="hover:bg-muted/30 cursor-pointer transition-colors group">

                        {/* Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {sub.logoFileId ? (
                              <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                                <img 
                                  src={filesAPI.getUrl(sub.logoFileId)} 
                                  alt={sub.name}
                                  className="w-9 h-9 object-contain rounded-xl"
                                  onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                                />
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <CreditCard className="w-4 h-4 text-primary" />
                              </div>
                            )}
                            <div className="font-semibold text-sm">{sub.name}</div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="px-6 py-4">
                          {sub.price ? (
                            <div>
                              <div className="font-semibold text-sm">{formatCurrency(sub.price, sub.currency)}</div>
                              <div className="text-xs text-muted-foreground capitalize">{sub.billingCycle}</div>
                            </div>
                          ) : <span className="text-muted-foreground text-sm">—</span>}
                        </td>

                        {/* Employee count */}
                        <td className="px-6 py-4">
                          {empCount > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <span className="text-xs font-bold text-blue-500">{empCount}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">{empCount === 1 ? 'employee' : 'employees'}</span>
                            </div>
                          ) : <span className="text-muted-foreground text-sm">—</span>}
                        </td>

                        {/* Renewal date */}
                        <td className="px-6 py-4">
                          {sub.renewalDate ? (
                            <div className={cn("text-sm", expired && "text-destructive", expiring && !expired && "text-amber-500")}>
                              {formatDate(sub.renewalDate)}
                              {expiring && !expired && (
                                <div className="flex items-center gap-1 text-xs font-medium mt-0.5">
                                  <AlertTriangle className="w-3 h-3" /> Expiring soon
                                </div>
                              )}
                              {expired && <div className="text-xs font-medium mt-0.5">Expired</div>}
                            </div>
                          ) : <span className="text-muted-foreground text-sm">—</span>}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={e => { e.stopPropagation(); onView(sub); }}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {!isReadOnly && (<>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={e => { e.stopPropagation(); onEdit(sub); }}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={e => { e.stopPropagation(); onDelete(sub); }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              </>)}
                            </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SubscriptionsPage() {
  const { isReadOnly } = useAuth();
  const navigate = useNavigate();
  const [subs, setSubs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, sub: null });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const [subsRes, empRes] = await Promise.all([
        cachedAPI('subscriptions', () => subscriptionsAPI.getAll()),
        cachedAPI('employees', () => employeesAPI.getAll()),
      ]);
      setSubs(subsRes.data);
      setEmployees(empRes.data);
    } catch { toast.error('Failed to load subscriptions'); }
    finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return subs.filter(s => !q || s.name?.toLowerCase().includes(q) || s.department?.toLowerCase().includes(q));
  }, [subs, searchQuery]);

  const activeSubs = filtered.filter(s => !s.renewalDate || !isExpired(s.renewalDate));
  const expiredSubs = filtered.filter(s => s.renewalDate && isExpired(s.renewalDate));

  const handleDelete = async () => {
    try {
      // Delete subscription (backend will handle logo file cleanup)
      await subscriptionsAPI.delete(deleteDialog.sub.id);
      invalidateCache(['subscriptions']);
      setSubs(prev => prev.filter(s => s.id !== deleteDialog.sub.id));
      toast.success('Subscription deleted');
    } catch { toast.error('Failed to delete'); }
    finally { setDeleteDialog({ open: false, sub: null }); }
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions & Licenses"
        description={`Tracking ${subs.length} company subscriptions and licenses`}
        actions={!isReadOnly && (
          <Button onClick={() => { setEditTarget(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />Add Subscription
          </Button>
        )}
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search subscriptions..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      {subs.length === 0 ? (
        <EmptyState icon={CreditCard} title="No subscriptions yet"
          description="Start tracking your company subscriptions and licenses"
          action={!isReadOnly && (
            <Button onClick={() => { setEditTarget(null); setFormOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Subscription
            </Button>
          )} />
      ) : (
        <div className="space-y-5">
          <SubTable items={activeSubs} title="Active Subscriptions" variant="active"
            onView={sub => navigate(`/subscriptions/${sub.id}`)}
            onEdit={s => { setEditTarget(s); setFormOpen(true); }}
            onDelete={s => setDeleteDialog({ open: true, sub: s })}
            isReadOnly={isReadOnly} />
          {expiredSubs.length > 0 && (
            <SubTable items={expiredSubs} title="Expired / Discontinued" variant="expired"
              onView={sub => navigate(`/subscriptions/${sub.id}`)}
              onEdit={s => { setEditTarget(s); setFormOpen(true); }}
              onDelete={s => setDeleteDialog({ open: true, sub: s })}
              isReadOnly={isReadOnly} />
          )}
        </div>
      )}

      <SubscriptionFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditTarget(null); }}
        onSaved={fetchData} initial={editTarget} employees={employees} />

      <AlertDialog open={deleteDialog.open} onOpenChange={open => setDeleteDialog({ open, sub: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.sub?.name}</strong>? This cannot be undone.
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
