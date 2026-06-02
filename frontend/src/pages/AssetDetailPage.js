import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Package,
  History,
  User,
  ImageIcon,
  X,
  FileText
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingPage } from '../components/common/LoadingSpinner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
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
import { assetsAPI, transfersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';

export default function AssetDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isReadOnly } = useAuth();
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [notePopup, setNotePopup] = useState(null);
  const [deleteTransferId, setDeleteTransferId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [assetRes, transfersRes] = await Promise.all([
        assetsAPI.getById(id),
        transfersAPI.getByAssetId(id)
      ]);
      setAsset(assetRes.data);
      setTransfers(transfersRes.data);
    } catch (error) {
      toast.error('Failed to load asset details');
      navigate('/assets');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    try {
      await assetsAPI.delete(id);
      toast.success('Asset deleted');
      navigate('/assets');
    } catch (error) {
      toast.error('Failed to delete asset');
    }
  };

  const handleDeleteTransfer = async () => {
    if (!deleteTransferId) return;
    try {
      await transfersAPI.delete(deleteTransferId);
      setTransfers(prev => prev.filter(t => t.id !== deleteTransferId));
      toast.success('Transfer record deleted');
    } catch {
      toast.error('Failed to delete transfer');
    } finally {
      setDeleteTransferId(null);
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  const getModelNumber = () => {
    const fv = asset.fieldValues || {};
    const fields = asset.assetType?.fields || [];
    const mf = fields.find(f => f.name === 'Model Number');
    return mf ? (fv[mf.id] || '') : '';
  };

  const getSubtitle = () => {
    return asset.assetType?.name || 'Asset';
  };

  if (loading) return <LoadingPage />;
  if (!asset) return null;

  const fieldValues = asset.fieldValues || {};
  const typeFields = asset.assetType?.fields || [];
  const hasImage = !!asset.imageUrl;

  return (
    <>
    <div data-testid="asset-detail-page">
      <PageHeader 
        title={getModelNumber() || asset.assetTag}
        description={getSubtitle()}
        actions={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/assets')} data-testid="back-btn">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            {!isReadOnly && (
              <>
                <Button variant="outline" onClick={() => navigate(`/assets/${id}/edit`)} data-testid="edit-btn">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  className="text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  data-testid="delete-btn"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* System Details */}
          <Card className="dark:border-border">
            <CardHeader>
              <CardTitle className="text-base">Asset Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Asset Tag</p>
                  <p className="font-mono font-medium">{asset.assetTag}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <Badge variant="outline">{asset.assetType?.name || 'N/A'}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={asset.assignedEmployeeId ? 'default' : 'secondary'}>
                    {asset.assignedEmployeeId ? 'Assigned' : 'In Inventory'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p>{formatDate(asset.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Field Values */}
          {typeFields.length > 0 && (
            <Card className="dark:border-border">
              <CardHeader>
                <CardTitle className="text-base">{asset.assetType?.name} Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {typeFields.map(field => (
                    <div key={field.id} data-testid={`field-display-${field.id}`}>
                      <p className="text-sm text-muted-foreground">{field.name}</p>
                      <p className="font-medium">
                        {fieldValues[field.id] !== undefined && fieldValues[field.id] !== '' 
                          ? String(fieldValues[field.id]) 
                          : '-'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transfer History */}
          <Card className="dark:border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4" />
                Transfer History
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-center">Note</TableHead>
                  <TableHead className="text-center">Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.length > 0 ? (
                  transfers.map((transfer) => (
                    <TableRow key={transfer.id} data-testid={`transfer-${transfer.id}`}>
                      <TableCell className="whitespace-nowrap">
                        {transfer.formattedDate || formatDate(transfer.date)}
                      </TableCell>
                      <TableCell>{transfer.fromName}</TableCell>
                      <TableCell>{transfer.toName}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate text-center">
                        {transfer.notes || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTransferId(transfer.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No transfer history
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* View Image Button */}
          <Card className="dark:border-border">
            <CardContent className="pt-6">
              <button
                onClick={() => hasImage && setImageModalOpen(true)}
                disabled={!hasImage}
                data-testid="view-image-btn"
                className={`
                  w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg
                  font-medium text-sm transition-all duration-200
                  ${hasImage 
                    ? 'bg-green-500/15 text-green-400 border border-green-500/40 hover:bg-green-500/25 hover:border-green-500/60 hover:scale-[1.02] cursor-pointer active:scale-[0.98]' 
                    : 'bg-muted/50 text-muted-foreground border border-border cursor-not-allowed opacity-60'
                  }
                `}
              >
                <ImageIcon className="w-4 h-4" />
                {hasImage ? 'View Image' : 'No Image Uploaded'}
              </button>
            </CardContent>
          </Card>

          {/* Assigned Employee */}
          <Card className="dark:border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Assigned To
              </CardTitle>
            </CardHeader>
            <CardContent>
              {asset.assignedEmployee ? (
                <button
                  onClick={() => navigate(`/employees/${asset.assignedEmployee.id}`)}
                  className="flex items-center gap-3 p-3 w-full rounded-lg hover:bg-accent transition-colors"
                  data-testid="assigned-employee-link"
                >
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(asset.assignedEmployee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <div className="font-medium">{asset.assignedEmployee.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {asset.assignedEmployee.employeeId}
                    </div>
                  </div>
                </button>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Not assigned</p>
                  <p className="text-sm">This asset is in inventory</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Image Modal */}
      <AnimatePresence>
        {imageModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
              onClick={() => setImageModalOpen(false)}
            />

            {/* Modal */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.88, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ duration: 0.22, ease: [0.34, 1.1, 0.64, 1] }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-6"
            >
              <div
                className="relative pointer-events-auto max-w-3xl w-full rounded-xl overflow-hidden shadow-2xl border border-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={() => setImageModalOpen(false)}
                  className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
                  data-testid="close-image-modal"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Image */}
                <img
                  src={asset.imageUrl}
                  alt={asset.assetTag}
                  className="w-full max-h-[80vh] object-contain bg-black"
                />

                {/* Footer label */}
                <div className="absolute bottom-0 left-0 right-0 px-4 py-2.5 bg-gradient-to-t from-black/70 to-transparent">
                  <p className="text-white text-sm font-mono font-medium">{asset.assetTag}</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{asset.assetTag}</strong>? 
              This will also delete all transfer history for this asset. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Note Popup */}
      {notePopup && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setNotePopup(null)}>
          <div className="bg-card border border-border rounded-xl p-5 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Transfer Note</h3>
              <button onClick={() => setNotePopup(null)} className="p-1 rounded-full hover:bg-accent transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notePopup}</p>
          </div>
        </div>
      )}

      {/* Delete Transfer Dialog */}
      <AlertDialog open={!!deleteTransferId} onOpenChange={(open) => !open && setDeleteTransferId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transfer Record</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this transfer record? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransfer} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </>
  );
}
