import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Eye,
  Edit,
  ArchiveX,
  Package,
  ChevronDown,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingPage } from '../components/common/LoadingSpinner';
import { ExportDropdown } from '../components/common/ExportDropdown';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { assetsAPI, assetTypesAPI, employeesAPI } from '../services/api';
import { cachedAPI, invalidateCache } from '../services/apiCache';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const STORAGE_KEY = 'assetflow_collapsed_groups';

export default function ModernAssetsPage() {
  const navigate = useNavigate();
  const { isReadOnly } = useAuth();
  const [assets, setAssets] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, asset: null });
  const [disposeReason, setDisposeReason] = useState('');

  // Load collapsed state from localStorage
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Save collapsed state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedGroups));
    } catch {}
  }, [collapsedGroups]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [assetsRes, typesRes, employeesRes] = await Promise.all([
        cachedAPI('assets', () => assetsAPI.getAll()),
        cachedAPI('asset-types', () => assetTypesAPI.getAll()),
        cachedAPI('employees', () => employeesAPI.getAll()),
      ]);
      setAssets(assetsRes.data);
      setAssetTypes(typesRes.data);
      setEmployees(employeesRes.data);
    } catch (error) {
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  }

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee?.name || 'Unknown';
  };

  const getModelNumber = (asset) => {
    if (!asset.fieldValues) return '—';
    const assetType = assetTypes.find(t => t.id === asset.assetTypeId);
    if (!assetType) return '—';
    const modelField = (assetType.fields || []).find(f => f.name === 'Model Number');
    if (!modelField) return '—';
    return asset.fieldValues[modelField.id] || '—';
  };

  const toggleGroup = (typeId) => {
    setCollapsedGroups(prev => ({ ...prev, [typeId]: !prev[typeId] }));
  };

  const filteredAssets = useMemo(() => {
    let filtered = assets;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(asset => {
        if (asset.assetTag?.toLowerCase().includes(query)) return true;
        const fv = asset.fieldValues || {};
        return Object.values(fv).some(v => String(v).toLowerCase().includes(query));
      });
    }
    if (filterType !== 'all') {
      filtered = filtered.filter(asset => asset.assetTypeId === filterType);
    }
    if (filterStatus === 'assigned') {
      filtered = filtered.filter(asset => asset.assignedEmployeeId);
    } else if (filterStatus === 'inventory') {
      filtered = filtered.filter(asset => !asset.assignedEmployeeId);
    }
    return filtered;
  }, [assets, searchQuery, filterType, filterStatus]);

  // Group assets by type
  const groupedAssets = useMemo(() => {
    const groups = {};
    filteredAssets.forEach(asset => {
      const typeId = asset.assetTypeId || 'unknown';
      if (!groups[typeId]) {
        const assetType = assetTypes.find(t => t.id === typeId);
        groups[typeId] = {
          typeId,
          typeName: assetType?.name || asset.assetType?.name || 'Unknown',
          assets: []
        };
      }
      groups[typeId].assets.push(asset);
    });
    return Object.values(groups);
  }, [filteredAssets, assetTypes]);

  const handleDelete = async () => {
    if (!deleteDialog.asset) return;
    const reason = disposeReason.trim();
    if (!reason) {
      toast.error('Please add a disposal reason');
      return;
    }
    try {
      await assetsAPI.dispose(deleteDialog.asset.id, { reason });
      invalidateCache(['assets', 'dashboard-stats', 'inventory', 'disposed-assets']);
      setAssets(prev => prev.filter(a => a.id !== deleteDialog.asset.id));
      toast.success('Asset moved to disposed assets');
    } catch (error) {
      toast.error('Failed to delete asset');
    } finally {
      setDeleteDialog({ open: false, asset: null });
      setDisposeReason('');
    }
  };

  const handleExport = (sendEmail) => assetsAPI.export(sendEmail);

  if (loading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Assets"
        description={`Manage all ${assets.length} assets`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ExportDropdown onExport={handleExport} />
            {!isReadOnly && (
              <Button onClick={() => navigate('/assets/new')} data-testid="add-asset-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Asset
              </Button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {assetTypes.map(type => (
              <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="inventory">Inventory</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grouped Assets */}
      {filteredAssets.length === 0 ? (
        <EmptyState 
          icon={Package}
          title="No assets found"
          description="Get started by adding your first asset"
          action={
            !isReadOnly && (
              <Button onClick={() => navigate('/assets/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Asset
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {groupedAssets.map(group => (
            <div key={group.typeId} className="rounded-lg border bg-card overflow-hidden">
              {/* Group Header */}
              <button
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                onClick={() => toggleGroup(group.typeId)}
              >
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-base">{group.typeName}</span>
                  <Badge variant="secondary" className="text-xs">{group.assets.length} assets</Badge>
                </div>
                <motion.div
                  animate={{ rotate: collapsedGroups[group.typeId] ? -90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              </button>

              {/* Group Table - Animated */}
              <AnimatePresence initial={false}>
                {!collapsedGroups[group.typeId] && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <Table style={{ tableLayout: 'fixed', width: '100%' }}>
                      <colgroup>
                        <col style={{ width: '35%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '35%' }} />
                        <col style={{ width: '15%' }} />
                      </colgroup>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-6">Model Number</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden md:table-cell">Assigned To</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.assets.map((asset) => (
                          <TableRow
                            key={asset.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => navigate(`/assets/${asset.id}`)}
                          >
                            <TableCell className="text-sm text-muted-foreground pl-6">
                              {getModelNumber(asset)}
                            </TableCell>
                            <TableCell>
                              {asset.assignedEmployeeId ? (
                                <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20">
                                  Assigned
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Inventory</Badge>
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {asset.assignedEmployeeId ? (
                                <span className="text-sm font-medium">{getEmployeeName(asset.assignedEmployeeId)}</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">In Inventory</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  title="View"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/assets/${asset.id}`); }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {!isReadOnly && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                      title="Edit"
                                      onClick={(e) => { e.stopPropagation(); navigate(`/assets/${asset.id}/edit`); }}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      title="Dispose"
                                      onClick={(e) => { e.stopPropagation(); setDisposeReason(''); setDeleteDialog({ open: true, asset }); }}
                                    >
                                      <ArchiveX className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) setDisposeReason('');
          setDeleteDialog({ open, asset: open ? deleteDialog.asset : null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dispose Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Move this asset out of active inventory and into Disposed Assets. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="dispose-reason-assets">
              Reason for disposal <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="dispose-reason-assets"
              value={disposeReason}
              onChange={(event) => setDisposeReason(event.target.value)}
              placeholder="Example: Damaged beyond repair, retired, lost, replaced..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!disposeReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Dispose
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
