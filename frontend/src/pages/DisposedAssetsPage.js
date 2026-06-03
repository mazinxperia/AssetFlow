import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArchiveX, RotateCcw, Search, Eye, Package, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingPage } from '../components/common/LoadingSpinner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
import { assetsAPI, assetTypesAPI } from '../services/api';
import { cachedAPI, invalidateCache } from '../services/apiCache';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';

export default function DisposedAssetsPage() {
  const navigate = useNavigate();
  const { isReadOnly } = useAuth();
  const [assets, setAssets] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [assetsRes, typesRes] = await Promise.all([
          cachedAPI('disposed-assets', () => assetsAPI.getDisposed()),
          cachedAPI('asset-types', () => assetTypesAPI.getAll()),
        ]);
        setAssets(assetsRes.data || []);
        setAssetTypes(typesRes.data || []);
      } catch {
        toast.error('Failed to load disposed assets');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getAssetType = useCallback((asset) => (
    assetTypes.find(type => type.id === asset.assetTypeId) || asset.assetType
  ), [assetTypes]);

  const getModelNumber = useCallback((asset) => {
    const assetType = getAssetType(asset);
    const modelField = (assetType?.fields || []).find(field => field.name === 'Model Number');
    return modelField ? (asset.fieldValues?.[modelField.id] || '—') : '—';
  }, [getAssetType]);

  const filteredAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter(asset => {
      const typeName = getAssetType(asset)?.name || '';
      const values = Object.values(asset.fieldValues || {}).join(' ');
      return [
        asset.assetTag,
        typeName,
        asset.disposalReason,
        values,
        getModelNumber(asset),
      ].some(value => String(value || '').toLowerCase().includes(query));
    });
  }, [assets, getAssetType, getModelNumber, searchQuery]);

  const handleRestore = async (asset) => {
    setRestoringId(asset.id);
    try {
      await assetsAPI.restore(asset.id);
      invalidateCache(['disposed-assets', 'assets', 'inventory', 'dashboard-stats']);
      setAssets(prev => prev.filter(item => item.id !== asset.id));
      toast.success('Asset restored to inventory');
    } catch {
      toast.error('Failed to restore asset');
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await assetsAPI.delete(deleteTarget.id);
      invalidateCache(['disposed-assets', 'assets', 'inventory', 'dashboard-stats']);
      setAssets(prev => prev.filter(item => item.id !== deleteTarget.id));
      toast.success('Asset permanently deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to permanently delete asset');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="space-y-6" data-testid="disposed-assets-page">
      <PageHeader
        title="Disposed Assets"
        description={`${assets.length} asset${assets.length === 1 ? '' : 's'} removed from active inventory`}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search disposed assets..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-10"
        />
      </div>

      {filteredAssets.length === 0 ? (
        <EmptyState
          icon={ArchiveX}
          title={searchQuery ? 'No disposed assets found' : 'No disposed assets'}
          description={searchQuery ? 'Try adjusting your search' : 'Assets moved out of service will appear here'}
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Model Number</TableHead>
                <TableHead>Asset Type</TableHead>
                <TableHead>Disposed Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map((asset) => {
                const assetType = getAssetType(asset);
                return (
                  <TableRow
                    key={asset.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                  >
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{getModelNumber(asset)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{assetType?.name || 'Unknown'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {asset.disposedAt ? formatDate(asset.disposedAt) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate">
                      {asset.disposalReason || 'No reason added'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="View"
                          onClick={() => navigate(`/assets/${asset.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {!isReadOnly && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-600 hover:bg-green-500/10"
                              title="Restore to inventory"
                              disabled={restoringId === asset.id || deletingId === asset.id}
                              onClick={() => handleRestore(asset)}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Permanently delete from database"
                              disabled={restoringId === asset.id || deletingId === asset.id}
                              onClick={() => setDeleteTarget(asset)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget ? getModelNumber(deleteTarget) : 'this asset'}</strong> from the database.
              This action cannot be undone. Restore it instead if you may need it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              disabled={!!deletingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
