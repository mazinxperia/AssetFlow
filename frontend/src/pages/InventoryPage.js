import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Boxes,
  Package,
  ChevronDown,
  Eye,
  Edit,
  ArchiveX,
  ArrowLeftRight
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
import { assetsAPI, assetTypesAPI, inventoryAPI } from '../services/api';
import { cachedAPI, invalidateCache } from '../services/apiCache';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const STORAGE_KEY = 'assetflow_inventory_collapsed_groups';

export default function InventoryPage() {
  const navigate = useNavigate();
  const { isReadOnly } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, asset: null });
  const [disposeReason, setDisposeReason] = useState('');

  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedGroups)); } catch {}
  }, [collapsedGroups]);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const [inventoryRes, typesRes] = await Promise.all([
        cachedAPI('inventory', () => assetsAPI.getInventory()),
        cachedAPI('asset-types', () => assetTypesAPI.getAll()),
      ]);
      setInventory(inventoryRes.data);
      setAssetTypes(typesRes.data);
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }

  const getModelNumber = (asset) => {
    if (!asset.fieldValues) return '—';
    const at = assetTypes.find(t => t.id === asset.assetTypeId);
    if (!at) return '—';
    const mf = (at.fields || []).find(f => f.name === 'Model Number');
    if (!mf) return '—';
    return asset.fieldValues[mf.id] || '—';
  };

  const toggleGroup = (typeId) => {
    setCollapsedGroups(prev => ({ ...prev, [typeId]: !prev[typeId] }));
  };

  const filteredInventory = useMemo(() => {
    if (!searchQuery) return inventory;
    const query = searchQuery.toLowerCase();
    return inventory.filter(asset => {
      if (asset.assetType?.name?.toLowerCase().includes(query)) return true;
      const fv = asset.fieldValues || {};
      return Object.values(fv).some(v => String(v).toLowerCase().includes(query));
    });
  }, [inventory, searchQuery]);

  const groupedInventory = useMemo(() => {
    const groups = {};
    filteredInventory.forEach(asset => {
      const typeId = asset.assetTypeId || 'unknown';
      if (!groups[typeId]) {
        const at = assetTypes.find(t => t.id === typeId);
        groups[typeId] = {
          typeId,
          typeName: at?.name || asset.assetType?.name || 'Unknown',
          assets: []
        };
      }
      groups[typeId].assets.push(asset);
    });
    return Object.values(groups);
  }, [filteredInventory, assetTypes]);

  const handleDelete = async () => {
    if (!deleteDialog.asset) return;
    const reason = disposeReason.trim();
    if (!reason) {
      toast.error('Please add a disposal reason');
      return;
    }
    try {
      await assetsAPI.dispose(deleteDialog.asset.id, { reason });
      invalidateCache(['inventory', 'assets', 'dashboard-stats', 'disposed-assets']);
      setInventory(prev => prev.filter(a => a.id !== deleteDialog.asset.id));
      toast.success('Asset moved to disposed assets');
    } catch (error) {
      toast.error('Failed to delete asset');
    } finally {
      setDeleteDialog({ open: false, asset: null });
      setDisposeReason('');
    }
  };

  const handleExport = (sendEmail) => inventoryAPI.export(sendEmail);

  if (loading) return <LoadingPage />;

  return (
    <div data-testid="inventory-page" className="space-y-6">
      <PageHeader 
        title="Inventory"
        description={`${inventory.length} unassigned assets available`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ExportDropdown onExport={handleExport} />
            {!isReadOnly && (
              <>
                <Button variant="outline" onClick={() => navigate('/transfers')} data-testid="transfer-btn">
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Transfer Assets
                </Button>
                <Button onClick={() => navigate('/assets/new')} data-testid="add-asset-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Asset
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search inventory..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="search-input"
        />
      </div>

      {filteredInventory.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No items in inventory"
          description={searchQuery ? "Try adjusting your search" : "All assets are currently assigned"}
          action={!isReadOnly && (
            <Button onClick={() => navigate('/assets/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Asset
            </Button>
          )}
        />
      ) : (
        <div className="space-y-4">
          {groupedInventory.map(group => (
            <div key={group.typeId} className="rounded-lg border bg-card overflow-hidden">
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
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '25%' }} />
                      </colgroup>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-6">Model Number</TableHead>
                          <TableHead>Asset Type</TableHead>
                          <TableHead>Assign</TableHead>
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
                            <TableCell className="pl-6 font-medium">
                              {getModelNumber(asset)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{group.typeName}</Badge>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {!isReadOnly && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={(e) => { e.stopPropagation(); navigate('/transfers', { state: { assetId: asset.id } }); }}
                                >
                                  <ArrowLeftRight className="w-3 h-3" />
                                  Assign to Employee
                                </Button>
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
              Move this asset out of inventory and into Disposed Assets. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="dispose-reason-inventory">
              Reason for disposal <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="dispose-reason-inventory"
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
