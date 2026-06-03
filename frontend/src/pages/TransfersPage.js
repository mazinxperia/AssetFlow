/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users,
  Boxes,
  Package,
  ChevronRight,
  Check,
  ArrowRight,
  Download,
  History,
  FileText,
  Trash2
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { TransferStepper } from '../components/common/TransferStepper';
import { LoadingPage } from '../components/common/LoadingSpinner';
import { ManualTransferDialog } from '../components/common/ManualTransferDialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Checkbox } from '../components/ui/checkbox';
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
import { employeesAPI, assetsAPI, transfersAPI, assetTypesAPI } from '../services/api';
import { cachedAPI, invalidateCache } from '../services/apiCache';
import { useAuth } from '../context/AuthContext';
import { cn, downloadCSV } from '../lib/utils';
import { toast } from 'sonner';

const STEPS = [
  { id: 'source', label: 'Select Source' },
  { id: 'assets', label: 'Select Assets' },
  { id: 'destination', label: 'Select Destination' },
  { id: 'confirm', label: 'Confirm' }
];

export default function TransfersPage() {
  const navigate = useNavigate(); // eslint-disable-line
  const location = useLocation(); // eslint-disable-line
  const { isReadOnly } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [employeeAssets, setEmployeeAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [employeeAssetCounts, setEmployeeAssetCounts] = useState({});
  const [notePopup, setNotePopup] = useState(null);
  const [deleteTransferId, setDeleteTransferId] = useState(null);
  
  // Transfer state
  const [sourceType, setSourceType] = useState(null); // 'employee' | 'inventory'
  const [sourceEmployee, setSourceEmployee] = useState(null);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [destinationType, setDestinationType] = useState(null); // 'employee' | 'inventory'
  const [destinationEmployee, setDestinationEmployee] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [assetTypes, setAssetTypes] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const getModelNumber = (asset) => {
    if (!asset.fieldValues) return '';
    const at = assetTypes.find(t => t.id === asset.assetTypeId);
    if (!at) return '';
    const mf = (at.fields || []).find(f => f.name === 'Model Number');
    if (!mf) return '';
    return asset.fieldValues[mf.id] || '';
  };

  async function fetchData() {
    try {
      const [employeesRes, inventoryRes, transfersRes, typesRes, allAssetsRes] = await Promise.all([
        cachedAPI('employees', () => employeesAPI.getAll()),
        cachedAPI('inventory', () => assetsAPI.getInventory()),
        cachedAPI('transfers', () => transfersAPI.getAll()),
        cachedAPI('asset-types', () => assetTypesAPI.getAll()),
        cachedAPI('assets', () => assetsAPI.getAll()),
      ]);
      setEmployees(employeesRes.data);
      setInventory(inventoryRes.data);
      setTransfers(transfersRes.data);
      setAssetTypes(typesRes.data || []);
      // Build per-employee asset count map
      const counts = {};
      (allAssetsRes.data || []).forEach(a => {
        if (a.assignedEmployeeId) {
          counts[a.assignedEmployeeId] = (counts[a.assignedEmployeeId] || 0) + 1;
        }
      });
      setEmployeeAssetCounts(counts);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const fetchEmployeeAssets = async (employeeId) => {
    setLoadingAssets(true);
    try {
      const response = await employeesAPI.getAssignedAssets(employeeId);
      setEmployeeAssets(response.data);
    } catch (error) {
      toast.error('Failed to load employee assets');
      setEmployeeAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  };

  const availableAssets = sourceType === 'inventory' 
    ? inventory 
    : employeeAssets;

  const handleSourceSelect = async (type, employeeId = null) => {
    setSourceType(type);
    setSourceEmployee(employeeId);
    setSelectedAssets([]);
    
    if (type === 'employee' && employeeId) {
      await fetchEmployeeAssets(employeeId);
    }
    
    setCurrentStep(1);
  };

  const handleAssetToggle = (assetId) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleDestinationSelect = (type, employeeId = null) => {
    setDestinationType(type);
    setDestinationEmployee(employeeId);
    setCurrentStep(3);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await transfersAPI.create({
        assetIds: selectedAssets,
        fromType: sourceType,
        fromId: sourceEmployee,
        toType: destinationType,
        toId: destinationEmployee,
        notes
      });
      
      toast.success('Transfer completed successfully!');
      
      // Reset form
      setCurrentStep(0);
      setSourceType(null);
      setSourceEmployee(null);
      setSelectedAssets([]);
      setDestinationType(null);
      setDestinationEmployee(null);
      setNotes('');
      
      // Refresh data
      fetchData();
    } catch (error) {
      toast.error('Failed to complete transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    const exportData = transfers.map(t => ({
      'Date': new Date(t.date).toLocaleDateString(),
      'Asset': t.asset?.assetType?.name || t.assetType?.name || 'N/A',
      'From Type': t.fromType,
      'From': t.fromName,
      'To Type': t.toType,
      'To': t.toName,
      'Notes': t.notes || ''
    }));
    downloadCSV(exportData, 'transfers');
    toast.success('Transfers exported successfully');
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

  if (loading) return <LoadingPage />;
  const historyMode = isReadOnly || showHistory;

  const contentVariants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <>
    <div data-testid="transfers-page">
      <PageHeader 
        title="Transfers"
        description="Transfer assets between employees and inventory"
        actions={
          <div className="flex items-center gap-3">
            {!isReadOnly && !historyMode && (
              <Button 
                variant="outline"
                onClick={() => setShowManualDialog(true)}
                data-testid="manual-transfer-btn"
              >
                <History className="w-4 h-4 mr-2" />
                Add Manual History
              </Button>
            )}
            {!isReadOnly && (
              <Button
                variant="outline"
                onClick={() => setShowHistory(!showHistory)}
                data-testid="toggle-history-btn"
              >
                {showHistory ? 'New Transfer' : 'View History'}
              </Button>
            )}
            {historyMode && (
              <Button variant="outline" onClick={handleExport} data-testid="export-btn">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        }
      />

      {/* Manual Transfer Dialog */}
      {!isReadOnly && (
        <ManualTransferDialog
          open={showManualDialog}
          onOpenChange={setShowManualDialog}
          onSuccess={fetchData}
        />
      )}

      {historyMode ? (
        // Transfer History
        <Card className="dark:border-border" data-testid="transfer-history">
          <CardHeader>
            <CardTitle>Transfer History</CardTitle>
            <CardDescription>All asset transfers</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Model Number</TableHead>
                <TableHead>From</TableHead>
                <TableHead></TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-center">Note</TableHead>
                {!isReadOnly && <TableHead className="text-center">Delete</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.length > 0 ? (
                transfers.map((transfer, index) => (
                  <motion.tr
                    key={transfer.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    data-testid={`transfer-row-${transfer.id}`}
                  >
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{transfer.formattedDate
                          ? transfer.formattedDate.split('–')[0].trim()
                          : new Date(transfer.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        }</span>
                        <span className="text-xs opacity-60">
                          {transfer.formattedDate
                            ? transfer.formattedDate.split('–')[1]?.trim()
                            : new Date(transfer.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                          }
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm">
                          {transfer.assetModelNumber || transfer.assetTypeName || 'N/A'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {transfer.assetTypeName || transfer.asset?.assetType?.name || ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{transfer.fromType}</Badge>
                      <span className="ml-2">{transfer.fromName}</span>
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{transfer.toType}</Badge>
                      <span className="ml-2">{transfer.toName}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {transfer.notes ? (
                        <button onClick={() => setNotePopup(transfer.notes)} className="inline-flex items-center justify-center p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="View note">
                          <FileText className="w-4 h-4" />
                        </button>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    {!isReadOnly && (
                      <TableCell className="text-center">
                        <button onClick={() => setDeleteTransferId(transfer.id)} className="inline-flex items-center justify-center p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    )}
                  </motion.tr>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={isReadOnly ? 6 : 7} className="text-center py-8 text-muted-foreground">
                    No transfer history yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        // New Transfer Wizard
        <>
          {/* Stepper */}
          <Card className="mb-8 dark:border-border">
            <CardContent className="p-8">
              <TransferStepper 
                steps={STEPS} 
                currentStep={currentStep}
                onStepClick={(step) => step < currentStep && setCurrentStep(step)}
              />
            </CardContent>
          </Card>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              variants={contentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.15 }}
            >
              {/* Step 1: Select Source */}
              {currentStep === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="step-source">
                  <Card 
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:-translate-y-1",
                      "dark:border-border"
                    )}
                    onClick={() => setSourceType('selectEmployee')}
                  >
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Users className="w-7 h-7 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-heading font-semibold text-lg">From Employee</h3>
                        <p className="text-muted-foreground">Transfer assets from an employee</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
                    </CardContent>
                  </Card>

                  <Card 
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:-translate-y-1",
                      "dark:border-border"
                    )}
                    onClick={() => handleSourceSelect('inventory')}
                  >
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-chart-2/10 flex items-center justify-center">
                        <Boxes className="w-7 h-7 text-chart-2" />
                      </div>
                      <div>
                        <h3 className="font-heading font-semibold text-lg">From Inventory</h3>
                        <p className="text-muted-foreground">Assign unassigned assets</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
                    </CardContent>
                  </Card>

                  {/* Employee Selection */}
                  {sourceType === 'selectEmployee' && (
                    <div className="col-span-full mt-4">
                      <Card className="dark:border-border">
                        <CardHeader>
                          <CardTitle>Select Source Employee</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">Only employees with assigned assets are shown</p>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {employees.map(employee => {
                              const count = employeeAssetCounts[employee.id] || 0;
                              const hasAssets = count > 0;
                              return (
                                <button
                                  key={employee.id}
                                  onClick={() => hasAssets && handleSourceSelect('employee', employee.id)}
                                  disabled={!hasAssets}
                                  className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg transition-colors text-left border",
                                    hasAssets
                                      ? "hover:bg-accent border-border cursor-pointer"
                                      : "opacity-40 cursor-not-allowed border-transparent"
                                  )}
                                  data-testid={`select-source-${employee.id}`}
                                >
                                  <Avatar>
                                    <AvatarFallback className={hasAssets ? "bg-primary/10 text-primary" : ""}>{getInitials(employee.name)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{employee.name}</div>
                                    <div className={cn("text-sm", hasAssets ? "text-primary font-medium" : "text-muted-foreground")}>
                                      {count} {count === 1 ? 'asset' : 'assets'}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Select Assets */}
              {currentStep === 1 && (
                <Card className="dark:border-border" data-testid="step-assets">
                  <CardHeader>
                    <CardTitle>Select Assets to Transfer</CardTitle>
                    <CardDescription>
                      {selectedAssets.length} asset(s) selected
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {availableAssets.map(asset => (
                        <div
                          key={asset.id}
                          className={cn(
                            "flex items-center gap-4 p-3 rounded-lg border transition-colors cursor-pointer",
                            selectedAssets.includes(asset.id) 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:bg-accent"
                          )}
                          onClick={() => handleAssetToggle(asset.id)}
                          data-testid={`select-asset-${asset.id}`}
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
                          <div>
                            <div className="font-medium">{getModelNumber(asset) || asset.assetType?.name || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">
                              {asset.assetType?.name}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex justify-between mt-6">
                      <Button variant="outline" onClick={() => setCurrentStep(0)}>
                        Back
                      </Button>
                      <Button 
                        onClick={() => setCurrentStep(2)}
                        disabled={selectedAssets.length === 0}
                      >
                        Continue
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Select Destination */}
              {currentStep === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="step-destination">
                  <Card 
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:-translate-y-1",
                      "dark:border-border",
                      sourceType === 'inventory' && "opacity-50 pointer-events-none"
                    )}
                    onClick={() => handleDestinationSelect('inventory')}
                  >
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-chart-2/10 flex items-center justify-center">
                        <Boxes className="w-7 h-7 text-chart-2" />
                      </div>
                      <div>
                        <h3 className="font-heading font-semibold text-lg">To Inventory</h3>
                        <p className="text-muted-foreground">Return assets to inventory</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
                    </CardContent>
                  </Card>

                  <Card 
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:-translate-y-1",
                      "dark:border-border"
                    )}
                    onClick={() => setDestinationType('selectEmployee')}
                  >
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Users className="w-7 h-7 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-heading font-semibold text-lg">To Employee</h3>
                        <p className="text-muted-foreground">Assign assets to an employee</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
                    </CardContent>
                  </Card>

                  {/* Employee Selection */}
                  {destinationType === 'selectEmployee' && (
                    <div className="col-span-full mt-4">
                      <Card className="dark:border-border">
                        <CardHeader>
                          <CardTitle>Select Destination Employee</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {employees
                              .filter(e => e.id !== sourceEmployee)
                              .map(employee => (
                                <button
                                  key={employee.id}
                                  onClick={() => handleDestinationSelect('employee', employee.id)}
                                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                                  data-testid={`select-dest-${employee.id}`}
                                >
                                  <Avatar>
                                    <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">{employee.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {employee.employeeId}
                                    </div>
                                  </div>
                                </button>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <div className="col-span-full">
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Confirm */}
              {currentStep === 3 && (
                <Card className="dark:border-border" data-testid="step-confirm">
                  <CardHeader>
                    <CardTitle>Confirm Transfer</CardTitle>
                    <CardDescription>Review and confirm the transfer details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Summary */}
                    <div className="flex items-center justify-center gap-4 p-6 rounded-xl bg-muted/50">
                      <div className="text-center">
                        <Badge variant="outline" className="mb-2">{sourceType}</Badge>
                        <p className="font-medium">
                          {sourceType === 'inventory' 
                            ? 'Inventory' 
                            : employees.find(e => e.id === sourceEmployee)?.name
                          }
                        </p>
                      </div>
                      <ArrowRight className="w-8 h-8 text-primary" />
                      <div className="text-center">
                        <Badge variant="outline" className="mb-2">{destinationType}</Badge>
                        <p className="font-medium">
                          {destinationType === 'inventory' 
                            ? 'Inventory' 
                            : employees.find(e => e.id === destinationEmployee)?.name
                          }
                        </p>
                      </div>
                    </div>

                    {/* Selected Assets */}
                    <div>
                      <Label className="mb-2 block">Assets ({selectedAssets.length})</Label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {availableAssets
                          .filter(a => selectedAssets.includes(a.id))
                          .map(asset => (
                            <div key={asset.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                              <Package className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{getModelNumber(asset) || asset.assetType?.name || 'N/A'}</span>
                              <span className="text-muted-foreground">-</span>
                              <span className="text-sm text-muted-foreground">
                                {asset.assetType?.name}
                              </span>
                            </div>
                          ))
                        }
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <Label htmlFor="notes" className="mb-2 block">Notes (optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Add any notes about this transfer..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        data-testid="transfer-notes"
                      />
                    </div>

                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => setCurrentStep(2)}>
                        Back
                      </Button>
                      <Button 
                        onClick={handleSubmit}
                        disabled={submitting}
                        data-testid="confirm-transfer-btn"
                      >
                        {submitting ? (
                          <>Processing...</>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Confirm Transfer
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
      {/* Note Popup */}
      {notePopup && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setNotePopup(null)}>
          <div className="bg-card border border-border rounded-xl p-5 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Transfer Note</h3>
              <button onClick={() => setNotePopup(null)} className="p-1 rounded-full hover:bg-accent"><span className="sr-only">Close</span>✕</button>
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
    </>
  );
}
