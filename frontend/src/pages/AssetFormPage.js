import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Camera, 
  Upload, 
  X, 
  Save,
  Plus
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingPage, LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { assetsAPI, assetTypesAPI, employeesAPI } from '../services/api';
import { toast } from 'sonner';

export default function AssetFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetTypes, setAssetTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ employeeId: '', name: '', email: '' });
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  const [form, setForm] = useState({
    assetTag: '',
    assetTypeId: '',
    assignedEmployeeId: '',
    imageUrl: '',
    fieldValues: {}
  });

  const fetchData = useCallback(async () => {
    try {
      const [typesRes, employeesRes] = await Promise.all([
        assetTypesAPI.getAll(),
        employeesAPI.getAll()
      ]);
      setAssetTypes(typesRes.data);
      setEmployees(employeesRes.data);

      if (isEditing) {
        const assetRes = await assetsAPI.getById(id);
        const asset = assetRes.data;
        setForm({
          assetTag: asset.assetTag || '',
          assetTypeId: asset.assetTypeId || '',
          assignedEmployeeId: asset.assignedEmployeeId || '',
          imageUrl: asset.imageUrl || '',
          fieldValues: asset.fieldValues || {}
        });
        setSelectedType(typesRes.data.find(t => t.id === asset.assetTypeId));
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [id, isEditing]);

  useEffect(() => {
    fetchData();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [fetchData]);

  const handleTypeChange = (typeId) => {
    setForm(prev => ({ ...prev, assetTypeId: typeId, fieldValues: {} }));
    setSelectedType(assetTypes.find(t => t.id === typeId));
  };

  const handleFieldValueChange = (fieldId, value) => {
    setForm(prev => ({
      ...prev,
      fieldValues: { ...prev.fieldValues, [fieldId]: value }
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await assetsAPI.uploadImage(formData);
      setForm(prev => ({ ...prev, imageUrl: response.data.url }));
      toast.success('Image uploaded');
    } catch (error) {
      toast.error('Failed to upload image');
    }
  };

  const startCamera = async () => {
    setCameraDialogOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      toast.error('Could not access camera');
      setCameraDialogOpen(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob(async (blob) => {
      try {
        const formData = new FormData();
        formData.append('image', blob, 'camera-capture.jpg');
        const response = await assetsAPI.uploadImage(formData);
        setForm(prev => ({ ...prev, imageUrl: response.data.url }));
        toast.success('Photo captured');
        stopCamera();
      } catch (error) {
        toast.error('Failed to upload photo');
      }
    }, 'image/jpeg', 0.8);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraDialogOpen(false);
  };

  const handleCreateEmployee = async () => {
    try {
      const response = await employeesAPI.create(newEmployee);
      setEmployees(prev => [...prev, response.data]);
      setForm(prev => ({ ...prev, assignedEmployeeId: response.data.id }));
      setEmployeeDialogOpen(false);
      setNewEmployee({ employeeId: '', name: '', email: '' });
      toast.success('Employee created');
    } catch (error) {
      toast.error('Failed to create employee');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEditing) {
        await assetsAPI.update(id, form);
        toast.success('Asset updated');
      } else {
        await assetsAPI.create(form);
        toast.success('Asset created');
      }
      navigate('/assets');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

  // Check if form is valid - only asset type is required, plus any required fields from type
  const isFormValid = () => {
    if (!form.assetTypeId) return false;
    
    if (selectedType?.fields) {
      for (const field of selectedType.fields) {
        if (field.required && !form.fieldValues[field.id]) {
          return false;
        }
      }
    }
    return true;
  };

  if (loading) return <LoadingPage />;

  return (
    <div data-testid="asset-form-page">
      <PageHeader 
        title={isEditing ? 'Edit Asset' : 'Add Asset'}
        description={isEditing ? 'Update asset details' : 'Create a new IT asset'}
        actions={
          <Button variant="ghost" onClick={() => navigate('/assets')} data-testid="back-btn">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Asset Type Selection */}
            <Card className="dark:border-border">
              <CardHeader>
                <CardTitle className="text-base">Asset Type *</CardTitle>
              </CardHeader>
              <CardContent>
                <Select 
                  value={form.assetTypeId} 
                  onValueChange={handleTypeChange}
                >
                  <SelectTrigger data-testid="asset-type-select">
                    <SelectValue placeholder="Select asset type" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assetTypes.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    No asset types configured. Go to Settings → Asset Types to create one.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Asset Tag - Optional (Auto-generated if empty) */}
            <Card className="dark:border-border">
              <CardHeader>
                <CardTitle className="text-base">Asset Identifier</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="assetTag">Asset Tag (Optional)</Label>
                  <Input
                    id="assetTag"
                    value={form.assetTag}
                    onChange={(e) => setForm(prev => ({ ...prev, assetTag: e.target.value }))}
                    placeholder="e.g., LAP-001 (leave empty for auto-generation)"
                    className="mt-2 font-mono"
                    data-testid="asset-tag-input"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to auto-generate a unique identifier
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Dynamic Fields from Asset Type */}
            {selectedType?.fields?.length > 0 && (
              <Card className="dark:border-border">
                <CardHeader>
                  <CardTitle className="text-base">{selectedType.name} Fields</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedType.fields.map(field => (
                    <div key={field.id}>
                      <Label htmlFor={field.id}>
                        {field.name}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {field.fieldType === 'select' ? (
                        <Select
                          value={form.fieldValues[field.id] || ''}
                          onValueChange={(value) => handleFieldValueChange(field.id, value)}
                        >
                          <SelectTrigger className="mt-2" data-testid={`field-${field.id}`}>
                            <SelectValue placeholder={`Select ${field.name}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.map(option => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : field.fieldType === 'textarea' ? (
                        <Textarea
                          id={field.id}
                          value={form.fieldValues[field.id] || ''}
                          onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                          placeholder={`Enter ${field.name.toLowerCase()}`}
                          className="mt-2"
                          required={field.required}
                          data-testid={`field-${field.id}`}
                        />
                      ) : field.fieldType === 'checkbox' ? (
                        <div className="flex items-center gap-2 mt-2">
                          <Checkbox
                            id={field.id}
                            checked={form.fieldValues[field.id] || false}
                            onCheckedChange={(checked) => handleFieldValueChange(field.id, checked)}
                            data-testid={`field-${field.id}`}
                          />
                          <Label htmlFor={field.id} className="font-normal">
                            {field.name}
                          </Label>
                        </div>
                      ) : (
                        <Input
                          id={field.id}
                          type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
                          value={form.fieldValues[field.id] || ''}
                          onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                          placeholder={`Enter ${field.name.toLowerCase()}`}
                          className="mt-2"
                          required={field.required}
                          data-testid={`field-${field.id}`}
                        />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Show message if no fields configured */}
            {selectedType && (!selectedType.fields || selectedType.fields.length === 0) && (
              <Card className="dark:border-border border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p>No custom fields configured for {selectedType.name}.</p>
                  <p className="text-sm mt-1">
                    Go to Settings → Asset Types to add fields.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Assignment */}
            <Card className="dark:border-border">
              <CardHeader>
                <CardTitle className="text-base">Assignment (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label htmlFor="employee">Assign to Employee</Label>
                    <Select
                      value={form.assignedEmployeeId || 'none'}
                      onValueChange={(value) => setForm(prev => ({ 
                        ...prev, 
                        assignedEmployeeId: value === 'none' ? '' : value 
                      }))}
                    >
                      <SelectTrigger className="mt-2" data-testid="employee-select">
                        <SelectValue placeholder="Select employee (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Inventory)</SelectItem>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} ({emp.employeeId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setEmployeeDialogOpen(true)}
                    data-testid="add-employee-inline-btn"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Image */}
          <div className="space-y-6">
            <Card className="dark:border-border">
              <CardHeader>
                <CardTitle className="text-base">Asset Image</CardTitle>
              </CardHeader>
              <CardContent>
                {form.imageUrl ? (
                  <div className="relative">
                    <img 
                      src={form.imageUrl} 
                      alt="Asset" 
                      className="w-full aspect-square object-cover rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, imageUrl: '' }))}
                      className="absolute top-2 right-2 w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                      data-testid="remove-image-btn"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Upload an image or capture from camera
                      </p>
                      <div className="flex gap-2">
                        <label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            data-testid="image-upload-input"
                          />
                          <Button type="button" variant="outline" size="sm" asChild>
                            <span>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload
                            </span>
                          </Button>
                        </label>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={startCamera}
                          data-testid="camera-btn"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Camera
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button 
              type="submit" 
              className="w-full"
              disabled={saving || !isFormValid()}
              data-testid="save-asset-btn"
            >
              {saving ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isEditing ? 'Update Asset' : 'Create Asset'}
            </Button>
          </div>
        </div>
      </form>

      {/* Camera Dialog */}
      <Dialog open={cameraDialogOpen} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Capture Photo</DialogTitle>
          </DialogHeader>
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={stopCamera}>Cancel</Button>
            <Button onClick={capturePhoto} data-testid="capture-photo-btn">
              <Camera className="w-4 h-4 mr-2" />
              Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Employee Dialog */}
      <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>Create a new employee to assign this asset</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="newEmployeeId">Employee ID *</Label>
              <Input
                id="newEmployeeId"
                value={newEmployee.employeeId}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, employeeId: e.target.value }))}
                placeholder="e.g., EMP001"
                className="mt-2"
                data-testid="new-employee-id-input"
              />
            </div>
            <div>
              <Label htmlFor="newEmployeeName">Name *</Label>
              <Input
                id="newEmployeeName"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                className="mt-2"
                data-testid="new-employee-name-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeeDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateEmployee}
              disabled={!newEmployee.employeeId || !newEmployee.name}
              data-testid="create-employee-btn"
            >
              Create Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
