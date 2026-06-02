import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Eye,
  Edit,
  Trash2,
  Users as UsersIcon,
  Package,
  ArrowUpDown,
  LayoutGrid,
  List
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingPage } from '../components/common/LoadingSpinner';
import { ExportDropdown } from '../components/common/ExportDropdown';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
import { employeesAPI } from '../services/api';
import { cachedAPI, invalidateCache } from '../services/apiCache';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const SORT_FIELDS = [
  { value: 'employeeId', label: 'Employee ID' },
  { value: 'name', label: 'Name' },
  { value: 'assets', label: 'Assets Assigned' },
];

const SORT_ORDERS = [
  { value: 'asc', label: 'Ascending (A → Z, Low → High)' },
  { value: 'desc', label: 'Descending (Z → A, High → Low)' },
];

export default function ModernEmployeesPage() {
  const navigate = useNavigate();
  const { isReadOnly } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, employee: null });
  
  // View mode state
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('employeeViewMode') || 'list';
  });
  
  // Sort state - separate field and order
  const [sortField, setSortField] = useState(() => {
    return localStorage.getItem('employeeSortField') || 'employeeId';
  });
  
  const [sortOrder, setSortOrder] = useState(() => {
    return localStorage.getItem('employeeSortOrder') || 'asc';
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('employeeSortField', sortField);
  }, [sortField]);

  useEffect(() => {
    localStorage.setItem('employeeSortOrder', sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    localStorage.setItem('employeeViewMode', viewMode);
  }, [viewMode]);

  async function fetchEmployees() {
    try {
      const response = await cachedAPI('employees', () => employeesAPI.getAll());
      setEmployees(response.data);
    } catch (error) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }

  const sortedAndFilteredEmployees = useMemo(() => {
    let result = [...employees];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(emp => {
        if (emp.name?.toLowerCase().includes(query)) return true;
        if (emp.employeeId?.toLowerCase().includes(query)) return true;
        const fv = emp.fieldValues || {};
        return Object.values(fv).some(v => String(v).toLowerCase().includes(query));
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal, bVal;
      
      if (sortField === 'employeeId') {
        aVal = a.employeeId?.toLowerCase() || '';
        bVal = b.employeeId?.toLowerCase() || '';
      } else if (sortField === 'name') {
        aVal = a.name?.toLowerCase() || '';
        bVal = b.name?.toLowerCase() || '';
      } else if (sortField === 'assets') {
        aVal = a._count?.assets || 0;
        bVal = b._count?.assets || 0;
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return result;
  }, [employees, searchQuery, sortField, sortOrder]);

  const handleDelete = async () => {
    if (!deleteDialog.employee) return;
    
    try {
      await employeesAPI.delete(deleteDialog.employee.id);
      invalidateCache(['employees', 'dashboard-stats']);
      setEmployees(prev => prev.filter(e => e.id !== deleteDialog.employee.id));
      toast.success('Employee deleted successfully');
    } catch (error) {
      toast.error('Failed to delete employee');
    } finally {
      setDeleteDialog({ open: false, employee: null });
    }
  };

  const handleExport = (sendEmail) => {
    return employeesAPI.export(sendEmail);
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Employees"
        description={`Manage all ${employees.length} employees`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ExportDropdown onExport={handleExport} />
            {!isReadOnly && (
              <Button onClick={() => navigate('/employees/new')} data-testid="add-employee-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            )}
          </div>
        }
      />

      {/* Search and Sort Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {/* Sort Dropdowns */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Select value={sortField} onValueChange={setSortField}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                {SORT_FIELDS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_ORDERS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* View Toggle Buttons */}
          <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/30">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'card' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Employees Display */}
      {sortedAndFilteredEmployees.length === 0 ? (
        <EmptyState 
          icon={UsersIcon}
          title="No employees found"
          description="Get started by adding your first employee"
          action={
            !isReadOnly && (
              <Button onClick={() => navigate('/employees/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            )
          }
        />
      ) : viewMode === 'card' ? (
        /* Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedAndFilteredEmployees.map((employee) => (
            <motion.div
              key={employee.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ 
                y: -4,
                transition: { type: "spring", stiffness: 400, damping: 25 }
              }}
              onClick={() => navigate(`/employees/${employee.id}`)}
              className="group relative rounded-xl border bg-card p-5 cursor-pointer transition-all duration-300 ease-out hover:shadow-lg hover:shadow-primary/20 hover:border-primary/50"
            >
              {/* Glow Effect - Smooth fade */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out pointer-events-none" />
              
              <div className="relative space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <UsersIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                          {employee.name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          ID: {employee.employeeId}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email */}
                {employee.fieldValues?.Email && (
                  <div className="text-sm text-muted-foreground truncate">
                    {employee.fieldValues.Email}
                  </div>
                )}

                {/* Assets Badge */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {employee._count?.assets || 0} {(employee._count?.assets || 0) === 1 ? 'asset' : 'assets'}
                  </span>
                </div>

                {/* Action Buttons */}
                {!isReadOnly && (
                  <div className="flex items-center gap-1 pt-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); navigate(`/employees/${employee.id}`); }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); navigate(`/employees/${employee.id}/edit`); }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, employee }); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* List View - Individual Cards */
        <div className="space-y-3">
          {sortedAndFilteredEmployees.map((employee) => (
            <motion.div
              key={employee.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate(`/employees/${employee.id}`)}
              className="group relative rounded-2xl border bg-card p-4 cursor-pointer transition-all duration-300 ease-out hover:shadow-md hover:shadow-primary/10 hover:border-primary/40"
            >
              {/* Subtle glow on hover - Smooth */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/3 to-primary/3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out pointer-events-none" />
              
              <div className="relative flex items-center gap-4">
                {/* Employee Info */}
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Employee ID */}
                  <div className="space-y-0.5">
                    <div className="text-xs text-muted-foreground">Employee ID</div>
                    <div className="font-semibold">{employee.employeeId}</div>
                  </div>
                  
                  {/* Name & Email */}
                  <div className="space-y-0.5">
                    <div className="text-xs text-muted-foreground">Name</div>
                    <div className="font-medium truncate">{employee.name}</div>
                    {employee.fieldValues?.Email && (
                      <div className="text-sm text-muted-foreground truncate">{employee.fieldValues.Email}</div>
                    )}
                  </div>
                  
                  {/* Assets */}
                  <div className="space-y-0.5">
                    <div className="text-xs text-muted-foreground">Assets Assigned</div>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">
                        {employee._count?.assets || 0} {(employee._count?.assets || 0) === 1 ? 'asset' : 'assets'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); navigate(`/employees/${employee.id}`); }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  {!isReadOnly && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); navigate(`/employees/${employee.id}/edit`); }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, employee }); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, employee: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete employee <strong>{deleteDialog.employee?.name}</strong>? All assigned assets will be moved to inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
