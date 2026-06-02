import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingPage, LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { employeesAPI, settingsAPI } from '../services/api';
import { toast } from 'sonner';

export default function EmployeeFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [form, setForm] = useState({
    employeeId: '',
    name: '',
    fieldValues: {}
  });

  const fetchData = useCallback(async () => {
    try {
      // Fetch custom fields configuration
      const fieldsRes = await settingsAPI.getEmployeeFields();
      setCustomFields(fieldsRes.data || []);

      if (isEditing) {
        const empRes = await employeesAPI.getById(id);
        const emp = empRes.data;
        setForm({
          employeeId: emp.employeeId || '',
          name: emp.name || '',
          fieldValues: emp.fieldValues || {}
        });
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [id, isEditing]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFieldValueChange = (fieldId, value) => {
    setForm(prev => ({
      ...prev,
      fieldValues: { ...prev.fieldValues, [fieldId]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEditing) {
        await employeesAPI.update(id, form);
        toast.success('Employee updated');
      } else {
        await employeesAPI.create(form);
        toast.success('Employee created');
      }
      navigate('/employees');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  // Check if form is valid
  const isFormValid = () => {
    if (!form.employeeId || !form.name) return false;
    
    for (const field of customFields) {
      if (field.required && !form.fieldValues[field.id]) {
        return false;
      }
    }
    return true;
  };

  if (loading) return <LoadingPage />;

  return (
    <div data-testid="employee-form-page">
      <PageHeader 
        title={isEditing ? 'Edit Employee' : 'Add Employee'}
        description={isEditing ? 'Update employee details' : 'Create a new employee record'}
        actions={
          <Button variant="ghost" onClick={() => navigate('/employees')} data-testid="back-btn">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit}>
        <Card className="dark:border-border max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">Employee Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Required System Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employeeId">Employee ID *</Label>
                <Input
                  id="employeeId"
                  value={form.employeeId}
                  onChange={(e) => setForm(prev => ({ ...prev, employeeId: e.target.value }))}
                  placeholder="e.g., EMP001"
                  className="mt-2 font-mono"
                  required
                  data-testid="employee-id-input"
                />
              </div>
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                  className="mt-2"
                  required
                  data-testid="name-input"
                />
              </div>
            </div>

            {/* Dynamic Custom Fields */}
            {customFields.length > 0 && (
              <>
                <div className="border-t border-border my-4" />
                <p className="text-sm text-muted-foreground mb-4">Custom Fields</p>
                {customFields.map(field => (
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
                      </div>
                    ) : (
                      <Input
                        id={field.id}
                        type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : 'text'}
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
              </>
            )}

            {/* Show message if no custom fields */}
            {customFields.length === 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted-foreground text-center py-4">
                  No custom fields configured. Go to Settings → Employee Fields to add fields.
                </p>
              </div>
            )}
            
            <div className="pt-4">
              <Button 
                type="submit" 
                disabled={saving || !isFormValid()}
                data-testid="save-employee-btn"
              >
                {saving ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isEditing ? 'Update Employee' : 'Create Employee'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
