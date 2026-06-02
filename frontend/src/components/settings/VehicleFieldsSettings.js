import React, { useEffect, useState } from 'react';
import { CarFront, Edit, FileImage, GripVertical, Image, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
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
import { settingsAPI } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { toast } from 'sonner';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (Dropdown)' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'image', label: 'Image / Document Photo' },
];

const emptyFieldForm = {
  name: '',
  fieldType: 'text',
  required: false,
  options: '',
  showInPreview: false,
  showInDetail: true,
  showInForm: true,
};

export function VehicleFieldsSettings() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [fieldForm, setFieldForm] = useState(emptyFieldForm);

  useEffect(() => {
    fetchFields();
  }, []);

  async function fetchFields() {
    try {
      const response = await settingsAPI.getVehicleFields();
      setFields(response.data || []);
    } catch (error) {
      toast.error('Failed to load vehicle fields');
    } finally {
      setLoading(false);
    }
  }

  function openDialog(field = null) {
    if (field) {
      setEditingField(field);
      setFieldForm({
        name: field.name || '',
        fieldType: field.fieldType || 'text',
        required: Boolean(field.required),
        options: field.options?.join(', ') || '',
        showInPreview: Boolean(field.showInPreview),
        showInDetail: field.showInDetail !== false,
        showInForm: field.showInForm !== false,
      });
    } else {
      setEditingField(null);
      setFieldForm(emptyFieldForm);
    }
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingField(null);
    setFieldForm(emptyFieldForm);
  }

  async function persistFields(nextFields, successMessage) {
    try {
      const response = await settingsAPI.updateVehicleFields(nextFields);
      setFields(response.data || nextFields);
      toast.success(successMessage);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save vehicle fields');
    }
  }

  async function handleSaveField() {
    const name = fieldForm.name.trim();
    if (!name) return;

    const fieldData = {
      name,
      fieldType: fieldForm.fieldType,
      required: fieldForm.required,
      showInPreview: fieldForm.showInPreview,
      showInDetail: fieldForm.showInDetail,
      showInForm: fieldForm.showInForm,
      options: fieldForm.fieldType === 'select'
        ? fieldForm.options.split(',').map(option => option.trim()).filter(Boolean)
        : null,
    };

    const nextFields = editingField
      ? fields.map(field => field.id === editingField.id ? { ...field, ...fieldData } : field)
      : [...fields, { id: Date.now().toString(), ...fieldData }];

    if (nextFields.filter(field => field.showInPreview).length > 4) {
      toast.error('Only 4 fields can appear around the car selector');
      return;
    }

    await persistFields(nextFields, editingField ? 'Vehicle field updated' : 'Vehicle field created');
    closeDialog();
  }

  async function handleDelete(fieldId) {
    await persistFields(fields.filter(field => field.id !== fieldId), 'Vehicle field deleted');
  }

  if (loading) return <LoadingSpinner />;

  const previewCount = fields.filter(field => field.showInPreview).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-heading font-semibold">Vehicle Fields</h2>
          <p className="text-sm text-muted-foreground">
            Build the custom details shown inside the Vehicle Fleet module.
          </p>
        </div>
        <Button onClick={() => openDialog()} data-testid="add-vehicle-field-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Field
        </Button>
      </div>

      <Card className="dark:border-border">
        <CardHeader>
          <CardTitle className="text-base">Locked Vehicle Fields</CardTitle>
          <CardDescription>These are always required and cannot be removed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-3">
              <CarFront className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Vehicle Name</span>
              <Badge variant="outline">text</Badge>
              <Badge>Required</Badge>
            </div>
            <span className="text-sm text-muted-foreground">System field</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-3">
              <Image className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Vehicle PNG Image</span>
              <Badge variant="outline">png</Badge>
              <Badge>Required</Badge>
            </div>
            <span className="text-sm text-muted-foreground">System field</span>
          </div>
        </CardContent>
      </Card>

      <Card className="dark:border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Custom Fleet Fields</CardTitle>
              <CardDescription>
                {previewCount}/4 fields selected for the main selector preview.
              </CardDescription>
            </div>
            <Badge variant={previewCount > 4 ? 'destructive' : 'secondary'}>{fields.length} fields</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length > 0 ? (
            <div className="space-y-2">
              {fields.map(field => (
                <div
                  key={field.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <GripVertical className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{field.name}</span>
                        <Badge variant="outline">{field.fieldType}</Badge>
                        {field.required && <Badge>Required</Badge>}
                        {field.showInPreview && <Badge variant="secondary">Selector Preview</Badge>}
                      </div>
                      {field.fieldType === 'image' && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <FileImage className="w-3 h-3" />
                          PNG, JPG, JPEG, or WebP photo card
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(field)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(field.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <CarFront className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No vehicle fields yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add fields like driver, plate number, company, Mulkiya, or insurance photo.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Vehicle Field' : 'New Vehicle Field'}</DialogTitle>
            <DialogDescription>
              Choose how this information behaves in forms, selector preview, and details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="vehicle-field-name">Field Name</Label>
              <Input
                id="vehicle-field-name"
                value={fieldForm.name}
                onChange={(event) => setFieldForm(prev => ({ ...prev, name: event.target.value }))}
                placeholder="e.g., Driver, Plate Number, Mulkiya"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="vehicle-field-type">Field Type</Label>
              <Select
                value={fieldForm.fieldType}
                onValueChange={(value) => setFieldForm(prev => ({ ...prev, fieldType: value }))}
              >
                <SelectTrigger id="vehicle-field-type" className="mt-2">
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
                <Label htmlFor="vehicle-field-options">Options</Label>
                <Input
                  id="vehicle-field-options"
                  value={fieldForm.options}
                  onChange={(event) => setFieldForm(prev => ({ ...prev, options: event.target.value }))}
                  placeholder="Option 1, Option 2, Option 3"
                  className="mt-2"
                />
              </div>
            )}

            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Required Field</Label>
                  <p className="text-xs text-muted-foreground">Admin must fill this while adding vehicles.</p>
                </div>
                <Switch
                  checked={fieldForm.required}
                  onCheckedChange={(checked) => setFieldForm(prev => ({ ...prev, required: checked }))}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Show Around Selector Car</Label>
                  <p className="text-xs text-muted-foreground">Maximum 4 fields can appear around the hero car.</p>
                </div>
                <Switch
                  checked={fieldForm.showInPreview}
                  onCheckedChange={(checked) => setFieldForm(prev => ({ ...prev, showInPreview: checked }))}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Show In Detail Page</Label>
                  <p className="text-xs text-muted-foreground">Visible after users click View Details.</p>
                </div>
                <Switch
                  checked={fieldForm.showInDetail}
                  onCheckedChange={(checked) => setFieldForm(prev => ({ ...prev, showInDetail: checked }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSaveField} disabled={!fieldForm.name.trim()}>
              {editingField ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
