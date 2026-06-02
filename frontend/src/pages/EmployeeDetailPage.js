import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Package,
  User,
  Plus,
  Check
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingPage, LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Separator } from '../components/ui/separator';
import { Checkbox } from '../components/ui/checkbox';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { employeesAPI, assetsAPI, assetTypesAPI, settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';

export default function EmployeeDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isReadOnly } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [assignedAssets, setAssignedAssets] = useState([]);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [assetTypes, setAssetTypes] = useState([]);

  const getModelNumber = (asset) => {
    if (!asset.fieldValues) return '';
    const at = assetTypes.find(t => t.id === asset.assetTypeId);
    if (!at) return '';
    const mf = (at.fields || []).find(f => f.name === 'Model Number');
    if (!mf) return '';
    return asset.fieldValues[mf.id] || '';
  };

  const fetchData = useCallback(async () => {
    try {
      const [employeeRes, assignedRes, inventoryRes, typesRes, fieldsRes] = await Promise.all([
        employeesAPI.getById(id),
        employeesAPI.getAssignedAssets(id),
        assetsAPI.getInventory(),
        assetTypesAPI.getAll(),
        settingsAPI.getEmployeeFields()
      ]);
      setEmployee(employeeRes.data);
      setAssignedAssets(assignedRes.data);
      setAvailableAssets(inventoryRes.data);
      setAssetTypes(typesRes.data || []);
      setCustomFields(fieldsRes.data || []);
    } catch (error) {
      toast.error('Failed to load employee details');
      navigate('/employees');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    try {
      await employeesAPI.delete(id);
      toast.success('Employee deleted');
      navigate('/employees');
    } catch (error) {
      toast.error('Failed to delete employee');
    }
  };

  const handleAssetToggle = (assetId) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleAssignAssets = async () => {
    if (selectedAssets.length === 0) return;
    
    setAssigning(true);
    try {
      // Update each selected asset to assign to this employee
      await Promise.all(
        selectedAssets.map(assetId => 
          assetsAPI.update(assetId, { assignedEmployeeId: id })
        )
      );
      
      toast.success(`${selectedAssets.length} asset(s) assigned successfully`);
      setAssignDialogOpen(false);
      setSelectedAssets([]);
      
      // Refresh data
      fetchData();
    } catch (error) {
      toast.error('Failed to assign assets');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignAsset = async (assetId) => {
    try {
      await assetsAPI.update(assetId, { assignedEmployeeId: null });
      toast.success('Asset unassigned');
      fetchData();
    } catch (error) {
      toast.error('Failed to unassign asset');
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  if (loading) return <LoadingPage />;
  if (!employee) return null;

  return (
    <div data-testid="employee-detail-page">
      <PageHeader 
        title={employee.name}
        description={`Employee ID: ${employee.employeeId}`}
        actions={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/employees')} data-testid="back-btn">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            {!isReadOnly && (
              <>
                <Button variant="outline" onClick={() => navigate(`/employees/${id}/edit`)} data-testid="edit-btn">
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
          {/* Employee Details */}
          <Card className="dark:border-border">
            <CardHeader>
              <CardTitle className="text-base">Employee Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                <Avatar className="w-20 h-20">
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                    {getInitials(employee.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Full Name</p>
                      <p className="font-medium">{employee.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      {employee.employeeId}
                    </Badge>
                  </div>
                  
                  {/* Custom Field Values */}
                  {customFields.map(field => {
                    const value = employee.fieldValues?.[field.id];
                    if (!value) return null;
                    return (
                      <div key={field.id} className="flex items-center gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">{field.name}</p>
                          <p className="font-medium">{value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="flex gap-6 text-sm text-muted-foreground">
                <div>
                  <span>Created:</span> {formatDate(employee.createdAt)}
                </div>
                <div>
                  <span>Updated:</span> {formatDate(employee.updatedAt)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Assets */}
          <Card className="dark:border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Assigned Assets
                  </CardTitle>
                  <CardDescription>{assignedAssets.length} asset(s) assigned</CardDescription>
                </div>
                {!isReadOnly && (
                  <Button onClick={() => setAssignDialogOpen(true)} data-testid="assign-asset-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Assign Asset
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {assignedAssets.length > 0 ? (
                <div className="space-y-3">
                  {assignedAssets.map((asset, index) => (
                    <motion.div
                      key={asset.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors"
                      data-testid={`asset-${asset.id}`}
                    >
                      <button
                        onClick={() => navigate(`/assets/${asset.id}`)}
                        className="flex items-center gap-4 text-left flex-1"
                      >
                        {asset.imageUrl ? (
                          <img 
                            src={asset.imageUrl} 
                            alt={asset.assetTag}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{getModelNumber(asset) || asset.assetType?.name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            {asset.assetType?.name || 'N/A'}
                          </div>
                        </div>
                      </button>
                      {!isReadOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassignAsset(asset.id)}
                          className="text-muted-foreground hover:text-destructive"
                          data-testid={`unassign-${asset.id}`}
                        >
                          Unassign
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Package}
                  title="No assets assigned"
                  description="This employee has no assets assigned yet"
                  action={!isReadOnly && (
                    <Button onClick={() => setAssignDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Assign Asset
                    </Button>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="dark:border-border">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Assets</span>
                <span className="font-semibold">{assignedAssets.length}</span>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Assets by Type</p>
                {Object.entries(
                  assignedAssets.reduce((acc, asset) => {
                    const type = asset.assetType?.name || 'Unknown';
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span>{type}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
                {assignedAssets.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No assets
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{employee.name}</strong>? 
              Transfer history will be preserved as text snapshots.
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

      {/* Assign Assets Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Assets to {employee.name}</DialogTitle>
            <DialogDescription>
              Select assets from inventory to assign. {selectedAssets.length} selected.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            {availableAssets.length > 0 ? (
              <div className="space-y-2">
                {availableAssets.map(asset => (
                  <div
                    key={asset.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedAssets.includes(asset.id) 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:bg-accent'
                    }`}
                    onClick={() => handleAssetToggle(asset.id)}
                    data-testid={`available-asset-${asset.id}`}
                  >
                    <Checkbox 
                      checked={selectedAssets.includes(asset.id)}
                      onCheckedChange={() => handleAssetToggle(asset.id)}
                    />
                    {asset.imageUrl ? (
                      <img 
                        src={asset.imageUrl} 
                        alt={asset.assetTag}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{getModelNumber(asset) || asset.assetType?.name || 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">
                        {asset.assetType?.name || 'N/A'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No assets available in inventory</p>
                <p className="text-sm mt-1">Add assets to inventory first</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignAssets}
              disabled={selectedAssets.length === 0 || assigning}
              data-testid="confirm-assign-btn"
            >
              {assigning ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Assign {selectedAssets.length > 0 ? `(${selectedAssets.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
