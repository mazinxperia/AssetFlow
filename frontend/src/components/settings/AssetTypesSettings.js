import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, GripVertical, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from '../ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { assetTypesAPI, assetFieldsAPI } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { toast } from 'sonner';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (Dropdown)' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'checkbox', label: 'Checkbox' },
];

export function AssetTypesSettings() {
  const [assetTypes, setAssetTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeDialog, setTypeDialog] = useState({ open: false, type: null });
  const [fieldDialog, setFieldDialog] = useState({ open: false, typeId: null, field: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null });
  const [typeName, setTypeName] = useState('');
  const [fieldForm, setFieldForm] = useState({
    name: '',
    fieldType: 'text',
    required: false,
    options: '',
    showInList: true,
    showInDetail: true,
    showInForm: true
  });

  useEffect(() => {
    fetchAssetTypes();
  }, []);

  async function fetchAssetTypes() {
    try {
      const response = await assetTypesAPI.getAll();
      setAssetTypes(response.data);
    } catch (error) {
      toast.error('Failed to load asset types');
    } finally {
      setLoading(false);
    }
  }

  const handleSaveType = async () => {
    try {
      if (typeDialog.type) {
        await assetTypesAPI.update(typeDialog.type.id, { name: typeName });
        toast.success('Asset type updated');
      } else {
        await assetTypesAPI.create({ name: typeName });
        toast.success('Asset type created');
      }
      fetchAssetTypes();
      setTypeDialog({ open: false, type: null });
      setTypeName('');
    } catch (error) {
      toast.error('Failed to save asset type');
    }
  };

  const handleDeleteType = async () => {
    try {
      await assetTypesAPI.delete(deleteDialog.type.id);
      setAssetTypes(prev => prev.filter(t => t.id !== deleteDialog.type.id));
      toast.success('Asset type deleted');
    } catch (error) {
      toast.error('Failed to delete asset type');
    } finally {
      setDeleteDialog({ open: false, type: null });
    }
  };

  const handleSaveField = async () => {
    try {
      const fieldData = {
        name: fieldForm.name,
        fieldType: fieldForm.fieldType,
        required: fieldForm.required,
        showInList: fieldForm.showInList,
        showInDetail: fieldForm.showInDetail,
        showInForm: fieldForm.showInForm,
        options: fieldForm.fieldType === 'select' ? fieldForm.options.split(',').map(o => o.trim()) : null
      };

      if (fieldDialog.field) {
        await assetFieldsAPI.update(fieldDialog.typeId, fieldDialog.field.id, fieldData);
        toast.success('Field updated');
      } else {
        await assetFieldsAPI.create(fieldDialog.typeId, fieldData);
        toast.success('Field created');
      }
      fetchAssetTypes();
      setFieldDialog({ open: false, typeId: null, field: null });
      resetFieldForm();
    } catch (error) {
      toast.error('Failed to save field');
    }
  };

  const handleDeleteField = async (typeId, fieldId) => {
    try {
      await assetFieldsAPI.delete(typeId, fieldId);
      fetchAssetTypes();
      toast.success('Field deleted');
    } catch (error) {
      toast.error('Failed to delete field');
    }
  };

  const resetFieldForm = () => {
    setFieldForm({ name: '', fieldType: 'text', required: false, options: '', showInList: true, showInDetail: true, showInForm: true });
  };

  const openFieldDialog = (typeId, field = null) => {
    if (field) {
      setFieldForm({
        name: field.name,
        fieldType: field.fieldType,
        required: field.required,
        options: field.options?.join(', ') || '',
        showInList: field.showInList !== false,
        showInDetail: field.showInDetail !== false,
        showInForm: field.showInForm !== false
      });
    } else {
      resetFieldForm();
    }
    setFieldDialog({ open: true, typeId, field });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-semibold">Asset Types</h2>
          <p className="text-sm text-muted-foreground">
            Configure asset types and their dynamic fields
          </p>
        </div>
        <Button 
          onClick={() => { setTypeName(''); setTypeDialog({ open: true, type: null }); }}
          data-testid="add-asset-type-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Asset Type
        </Button>
      </div>

      <div className="grid gap-4">
        {assetTypes.map(type => (
          <Card key={type.id} className="dark:border-border" data-testid={`asset-type-${type.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{type.name}</CardTitle>
                  <Badge variant="secondary">{type.fields?.length || 0} fields</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openFieldDialog(type.id)}
                    data-testid={`add-field-${type.id}`}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Field
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => { setTypeName(type.name); setTypeDialog({ open: true, type }); }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setDeleteDialog({ open: true, type })}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {type.fields?.length > 0 && (
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {type.fields.map(field => (
                    <div 
                      key={field.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{field.name}</span>
                          <span className="text-muted-foreground ml-2 text-sm">
                            ({field.fieldType})
                          </span>
                          {field.required && (
                            <Badge variant="outline" className="ml-2 text-xs">Required</Badge>
                          )}

                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!field.locked && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openFieldDialog(type.id, field)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {!field.locked && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteField(type.id, field.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}

        {assetTypes.length === 0 && (
          <Card className="dark:border-border">
            <CardContent className="py-12 text-center">
              <Settings className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-heading font-semibold mb-2">No Asset Types</h3>
              <p className="text-muted-foreground mb-4">
                Create your first asset type to get started
              </p>
              <Button onClick={() => setTypeDialog({ open: true, type: null })}>
                <Plus className="w-4 h-4 mr-2" />
                Add Asset Type
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Asset Type Dialog */}
      <Dialog open={typeDialog.open} onOpenChange={(open) => setTypeDialog({ open, type: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {typeDialog.type ? 'Edit Asset Type' : 'New Asset Type'}
            </DialogTitle>
            <DialogDescription>
              {typeDialog.type ? 'Update the asset type name' : 'Create a new asset type'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="typeName">Name</Label>
            <Input
              id="typeName"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              placeholder="e.g., Laptop, Monitor, Keyboard"
              className="mt-2"
              data-testid="type-name-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialog({ open: false, type: null })}>
              Cancel
            </Button>
            <Button onClick={handleSaveType} disabled={!typeName.trim()} data-testid="save-type-btn">
              {typeDialog.type ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Dialog */}
      <Dialog open={fieldDialog.open} onOpenChange={(open) => setFieldDialog({ open, typeId: null, field: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {fieldDialog.field ? 'Edit Field' : 'New Field'}
            </DialogTitle>
            <DialogDescription>
              Configure the field properties
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="fieldName">Field Name</Label>
              <Input
                id="fieldName"
                value={fieldForm.name}
                onChange={(e) => setFieldForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Serial Number, Model"
                className="mt-2"
                data-testid="field-name-input"
              />
            </div>
            <div>
              <Label htmlFor="fieldType">Field Type</Label>
              <Select 
                value={fieldForm.fieldType} 
                onValueChange={(value) => setFieldForm(prev => ({ ...prev, fieldType: value }))}
              >
                <SelectTrigger className="mt-2" data-testid="field-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {fieldForm.fieldType === 'select' && (
              <div>
                <Label htmlFor="options">Options (comma-separated)</Label>
                <Input
                  id="options"
                  value={fieldForm.options}
                  onChange={(e) => setFieldForm(prev => ({ ...prev, options: e.target.value }))}
                  placeholder="Option 1, Option 2, Option 3"
                  className="mt-2"
                  data-testid="field-options-input"
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="required">Required Field</Label>
              <Switch
                id="required"
                checked={fieldForm.required}
                onCheckedChange={(checked) => setFieldForm(prev => ({ ...prev, required: checked }))}
                data-testid="field-required-switch"
              />
            </div>
            

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialog({ open: false, typeId: null, field: null })}>
              Cancel
            </Button>
            <Button onClick={handleSaveField} disabled={!fieldForm.name.trim()} data-testid="save-field-btn">
              {fieldDialog.field ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, type: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.type?.name}</strong>? 
              This will also delete all associated fields. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteType} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
