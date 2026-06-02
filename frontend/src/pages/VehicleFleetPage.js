import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  CarFront,
  ChevronRight,
  Edit,
  Eye,
  FileImage,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { vehiclesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
import { Badge } from '../components/ui/badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;
const SOFT_FADE = { duration: 0.24, ease: [0.22, 1, 0.36, 1] };
const VEHICLE_SPRING = { type: 'spring', stiffness: 180, damping: 28, mass: 0.9 };

function resolveVehicleFileUrl(path) {
  if (!path) return '';
  return path.startsWith('http') ? path : vehiclesAPI.getFileUrl(path.split('/').pop());
}

function formatBytes(size) {
  if (!size) return '';
  const mb = size / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(size / 1024)} KB`;
}

function formatFieldValue(field, value) {
  if (value === undefined || value === null || value === '') return 'Not added';
  if (field.fieldType === 'checkbox') return value ? 'Yes' : 'No';
  if (field.fieldType === 'date') {
    try {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(value));
    } catch {
      return value;
    }
  }
  if (field.fieldType === 'image') {
    return value?.filename || 'View document';
  }
  return String(value);
}

function getFileValueUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return vehiclesAPI.getFileUrl(value);
  if (value.url?.startsWith('http')) return value.url;
  if (value.fileId) return vehiclesAPI.getFileUrl(value.fileId);
  if (value.url) return resolveVehicleFileUrl(value.url);
  return '';
}

function FieldInput({ field, value, onChange, onUpload }) {
  const inputId = `vehicle-field-${field.id}`;

  if (field.fieldType === 'textarea') {
    return (
      <Textarea
        id={inputId}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Enter ${field.name}`}
        rows={3}
      />
    );
  }

  if (field.fieldType === 'select') {
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger id={inputId}>
          <SelectValue placeholder={`Select ${field.name}`} />
        </SelectTrigger>
        <SelectContent>
          {(field.options || []).map(option => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.fieldType === 'checkbox') {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
        <span className="text-sm text-muted-foreground">Enabled</span>
        <Switch checked={Boolean(value)} onCheckedChange={onChange} />
      </div>
    );
  }

  if (field.fieldType === 'image') {
    const fileName = value?.filename;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById(inputId)?.click()}
          >
            <FileImage className="mr-2 h-4 w-4" />
            {fileName ? 'Replace Photo' : 'Upload Photo'}
          </Button>
          {fileName && (
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{fileName}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(value.size)}</p>
            </div>
          )}
        </div>
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={(event) => onUpload(event.target.files?.[0])}
        />
      </div>
    );
  }

  return (
    <Input
      id={inputId}
      type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={`Enter ${field.name}`}
    />
  );
}

function DockItem({ vehicle, active, onSelect, scale = 1 }) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(vehicle)}
      initial={false}
      animate={{ scale: active ? Math.max(scale, 1.08) : scale, y: scale > 1.06 ? -6 * (scale - 1) : 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24, mass: 0.45 }}
      style={{ zIndex: Math.round(scale * 20) }}
      className={cn(
        "group relative flex h-[92px] w-[92px] shrink-0 origin-bottom items-center justify-center overflow-visible rounded-2xl p-2 transition-colors",
        active ? "text-primary" : "text-foreground"
      )}
    >
      <img
        src={resolveVehicleFileUrl(vehicle.imageUrl)}
        alt={vehicle.name}
        className="h-16 w-full object-contain drop-shadow-xl transition-transform duration-150 group-hover:scale-105"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-full bg-background/85 px-2 py-1 text-center text-[11px] font-medium shadow-sm backdrop-blur-md">
        <span className="block truncate">{vehicle.name}</span>
      </div>
      {active && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_rgb(var(--primary))]" />}
    </motion.button>
  );
}

function VehicleDock({ vehicles, selectedVehicle, onSelect }) {
  const dockRef = useRef(null);
  const [mouseX, setMouseX] = useState(null);
  const itemSize = 92;
  const gap = 14;
  const padding = 16;
  const effectWidth = 320;
  const maxScale = 1.32;

  function getScale(index) {
    if (mouseX === null) return 1;
    const center = padding + index * (itemSize + gap) + itemSize / 2;
    const minX = mouseX - effectWidth / 2;
    const maxX = mouseX + effectWidth / 2;

    if (center < minX || center > maxX) return 1;
    const theta = ((center - minX) / effectWidth) * 2 * Math.PI;
    const scaleFactor = (1 - Math.cos(theta)) / 2;
    return 1 + scaleFactor * (maxScale - 1);
  }

  return (
    <div
      ref={dockRef}
      onMouseMove={(event) => {
        const rect = dockRef.current?.getBoundingClientRect();
        if (!rect || !dockRef.current) return;
        setMouseX(event.clientX - rect.left + dockRef.current.scrollLeft);
      }}
      onMouseLeave={() => setMouseX(null)}
      className="mx-auto flex max-w-4xl items-end gap-[14px] overflow-x-auto overflow-y-visible px-4 py-5"
    >
      {vehicles.map((vehicle, index) => (
        <DockItem
          key={vehicle.id}
          vehicle={vehicle}
          active={vehicle.id === selectedVehicle?.id}
          onSelect={onSelect}
          scale={getScale(index)}
        />
      ))}
    </div>
  );
}

function PreviewCard({ field, value, index, position }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ ...SOFT_FADE, delay: 0.04 + index * 0.02 }}
      className="absolute z-40 hidden w-[220px] lg:block"
      style={position}
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/50 p-4 shadow-xl backdrop-blur-2xl"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            background:
              'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.22), transparent 30%), linear-gradient(135deg, rgb(var(--primary) / 0.18), transparent 42%, rgba(255,255,255,0.08) 74%)',
          }}
        />
        <div
          className="pointer-events-none absolute -inset-10 opacity-25 blur-2xl"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgb(var(--primary) / 0.45), transparent 45%)',
          }}
        />
        <div className="relative z-10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.name}</p>
          <p className="mt-1 truncate text-lg font-semibold">{formatFieldValue(field, value)}</p>
        </div>
      </div>
    </motion.div>
  );
}

function VehicleFormDialog({ open, onOpenChange, vehicle, fields, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [uploadingFieldId, setUploadingFieldId] = useState(null);
  const [form, setForm] = useState({ name: '', imageFileId: '', imageUrl: '', fieldValues: {} });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: vehicle?.name || '',
      imageFileId: vehicle?.imageFileId || '',
      imageUrl: vehicle?.imageUrl ? resolveVehicleFileUrl(vehicle.imageUrl) : '',
      fieldValues: vehicle?.fieldValues || {},
    });
  }, [open, vehicle]);

  async function uploadFile(file, kind) {
    if (!file) return null;
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error('Vehicle files must be 25 MB or smaller');
      return null;
    }
    if (kind === 'hero' && file.type !== 'image/png') {
      toast.error('Vehicle image must be PNG');
      return null;
    }
    if (kind === 'field' && !['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error('Vehicle document photos must be PNG, JPG, JPEG, or WebP');
      return null;
    }

    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', file);
    const response = await vehiclesAPI.uploadFile(formData);
    return response.data;
  }

  async function handleHeroUpload(file) {
    try {
      const uploaded = await uploadFile(file, 'hero');
      if (!uploaded) return;
      setForm(prev => ({
        ...prev,
        imageFileId: uploaded.fileId,
        imageUrl: vehiclesAPI.getFileUrl(uploaded.fileId),
      }));
      toast.success('Vehicle image uploaded');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload vehicle image');
    }
  }

  async function handleFieldUpload(field, file) {
    setUploadingFieldId(field.id);
    try {
      const uploaded = await uploadFile(file, 'field');
      if (!uploaded) return;
      setForm(prev => ({
        ...prev,
        fieldValues: {
          ...prev.fieldValues,
          [field.id]: uploaded,
        },
      }));
      toast.success(`${field.name} uploaded`);
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to upload ${field.name}`);
    } finally {
      setUploadingFieldId(null);
    }
  }

  function updateFieldValue(fieldId, value) {
    setForm(prev => ({
      ...prev,
      fieldValues: {
        ...prev.fieldValues,
        [fieldId]: value,
      },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error('Vehicle name is required');
      return;
    }
    if (!form.imageFileId) {
      toast.error('Vehicle PNG image is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        imageFileId: form.imageFileId,
        fieldValues: form.fieldValues,
      };
      if (vehicle) {
        await vehiclesAPI.update(vehicle.id, payload);
        toast.success('Vehicle updated');
      } else {
        await vehiclesAPI.create(payload);
        toast.success('Vehicle added');
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save vehicle');
    } finally {
      setSaving(false);
    }
  }

  const visibleFields = fields.filter(field => field.showInForm !== false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{vehicle ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
            <DialogDescription>
              Vehicle name and PNG image are required. Other fields follow your Fleet settings.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-5 md:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-3">
              <Label>Vehicle PNG Image</Label>
              <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed bg-muted/30 p-4">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="Vehicle preview" className="h-full w-full object-contain" />
                ) : (
                  <div className="text-center text-sm text-muted-foreground">
                    <ImageIcon className="mx-auto mb-2 h-8 w-8" />
                    Transparent PNG works best
                  </div>
                )}
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => document.getElementById('vehicle-hero-upload')?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload PNG
              </Button>
              <input
                id="vehicle-hero-upload"
                type="file"
                accept="image/png"
                className="hidden"
                onChange={(event) => handleHeroUpload(event.target.files?.[0])}
              />
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="vehicle-name">Vehicle Name</Label>
                <Input
                  id="vehicle-name"
                  value={form.name}
                  onChange={(event) => setForm(prev => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g., STZ/29"
                  required
                />
              </div>

              {visibleFields.map(field => (
                <div key={field.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`vehicle-field-${field.id}`}>{field.name}</Label>
                    {field.required && <Badge variant="outline">Required</Badge>}
                  </div>
                  <FieldInput
                    field={field}
                    value={form.fieldValues[field.id]}
                    onChange={(value) => updateFieldValue(field.id, value)}
                    onUpload={(file) => handleFieldUpload(field, file)}
                  />
                  {uploadingFieldId === field.id && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading {field.name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {vehicle ? 'Save Vehicle' : 'Create Vehicle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailFieldCard({ field, value, onOpenFile }) {
  const isImage = field.fieldType === 'image';
  const fileName = isImage ? value?.filename : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="rounded-2xl border border-white/10 bg-card/55 p-5 shadow-lg backdrop-blur-2xl"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.name}</p>
      {isImage ? (
        value ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{fileName || 'Vehicle document'}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(value.size)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => onOpenFile(field, value)}>
              <Eye className="mr-2 h-4 w-4" />
              View
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-muted-foreground">Not uploaded</p>
        )
      ) : (
        <p className="mt-2 break-words text-lg font-semibold">{formatFieldValue(field, value)}</p>
      )}
    </motion.div>
  );
}

function EmptyFleet({ canWrite, onAdd }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-3xl border border-dashed bg-background/70 p-10 text-center shadow-xl backdrop-blur-xl">
        <CarFront className="mx-auto mb-4 h-14 w-14 text-primary" />
        <h2 className="text-2xl font-heading font-semibold">No vehicles yet</h2>
        <p className="mt-2 text-muted-foreground">
          Add company vehicles with transparent PNG renders and custom fleet fields.
        </p>
        {canWrite && (
          <Button className="mt-6" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle
          </Button>
        )}
      </div>
    </div>
  );
}

export default function VehicleFleetPage() {
  const { canWrite } = useAuth();
  const stageRef = useRef(null);
  const blurTimerRef = useRef(null);
  const [vehicles, setVehicles] = useState([]);
  const [fields, setFields] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('selector');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [deleteVehicle, setDeleteVehicle] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [carMotionBlur, setCarMotionBlur] = useState(false);

  const selectedVehicle = useMemo(() => {
    return vehicles.find(vehicle => vehicle.id === selectedId) || vehicles[0] || null;
  }, [selectedId, vehicles]);

  const previewFields = useMemo(() => {
    return fields.filter(field => field.showInPreview && field.showInDetail !== false).slice(0, 4);
  }, [fields]);

  const detailFields = useMemo(() => {
    return fields.filter(field => field.showInDetail !== false);
  }, [fields]);

  const vehicleStage = useMemo(() => {
    const width = stageSize.width || 1200;
    const height = stageSize.height || 650;
    const carWidth = Math.min(width * 0.54, 720);
    const carHeight = 430;
    const selectorX = Math.max(0, (width - carWidth) / 2);
    const selectorY = Math.max(36, (height * 0.43) - (carHeight / 2));
    const detailScale = Math.min(0.58, Math.max(0.48, 410 / carWidth));

    return {
      carWidth,
      carHeight,
      selector: { x: selectorX, y: selectorY, scale: 1 },
      detail: { x: 0, y: 8, scale: detailScale },
    };
  }, [stageSize]);

  const selectorButtonPosition = useMemo(() => {
    return {
      left: vehicleStage.selector.x + vehicleStage.carWidth / 2,
      top: vehicleStage.selector.y + vehicleStage.carHeight * 0.83,
    };
  }, [vehicleStage]);

  const previewCardPositions = useMemo(() => {
    const width = stageSize.width || 1200;
    const height = stageSize.height || 650;
    const cardWidth = 220;
    const cardHeight = 96;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const horizontalGap = Math.max(26, Math.min(52, width * 0.035));
    const verticalInset = Math.max(18, Math.min(52, vehicleStage.carHeight * 0.11));
    const leftLane = clamp(vehicleStage.selector.x - cardWidth - horizontalGap, 20, width - cardWidth - 20);
    const rightLane = clamp(vehicleStage.selector.x + vehicleStage.carWidth + horizontalGap, 20, width - cardWidth - 20);
    const topLane = clamp(vehicleStage.selector.y + verticalInset, 24, height - cardHeight - 24);
    const bottomLane = clamp(vehicleStage.selector.y + vehicleStage.carHeight - cardHeight - verticalInset, 24, height - cardHeight - 24);

    return [
      { left: leftLane, top: topLane },
      { left: rightLane, top: topLane },
      { left: leftLane, top: bottomLane },
      { left: rightLane, top: bottomLane },
    ];
  }, [stageSize, vehicleStage]);

  const fetchData = useCallback(async () => {
    try {
      const [vehiclesResponse, fieldsResponse] = await Promise.all([
        vehiclesAPI.getAll(),
        vehiclesAPI.getFields(),
      ]);
      const nextVehicles = vehiclesResponse.data || [];
      setVehicles(nextVehicles);
      setFields(fieldsResponse.data || []);
      setSelectedId(prev => {
        if (prev && nextVehicles.some(vehicle => vehicle.id === prev)) return prev;
        const stored = localStorage.getItem('assetflow-selected-vehicle');
        if (stored && nextVehicles.some(vehicle => vehicle.id === stored)) return stored;
        return nextVehicles[0]?.id || null;
      });
    } catch (error) {
      toast.error('Failed to load Vehicle Fleet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedId) localStorage.setItem('assetflow-selected-vehicle', selectedId);
  }, [selectedId]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setStageSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    };
  }, []);

  function startCarMotionBlur() {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    setCarMotionBlur(true);
    blurTimerRef.current = window.setTimeout(() => {
      setCarMotionBlur(false);
    }, 560);
  }

  function handleSelect(vehicle) {
    setSelectedId(vehicle.id);
    setMode('selector');
  }

  function openSelector() {
    if (mode !== 'selector') startCarMotionBlur();
    setMode('selector');
  }

  function openSelectedDetails() {
    if (mode !== 'detail') startCarMotionBlur();
    setMode('detail');
  }

  function openCreateDialog() {
    setEditingVehicle(null);
    setFormOpen(true);
  }

  function openEditDialog(vehicle) {
    setEditingVehicle(vehicle);
    setFormOpen(true);
  }

  async function handleDeleteVehicle() {
    if (!deleteVehicle) return;
    try {
      await vehiclesAPI.delete(deleteVehicle.id);
      toast.success('Vehicle deleted');
      setDeleteVehicle(null);
      setMode('selector');
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete vehicle');
    }
  }

  if (loading) return <LoadingSpinner />;

  if (!vehicles.length) {
    return (
      <>
        <EmptyFleet canWrite={canWrite} onAdd={openCreateDialog} />
        <VehicleFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          vehicle={editingVehicle}
          fields={fields}
          onSaved={fetchData}
        />
      </>
    );
  }

  return (
    <div
      className="relative -m-4 min-h-[calc(100vh-4rem)] overflow-x-hidden bg-transparent p-4 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-card/10 backdrop-blur-[1.5px]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-8rem)] max-w-7xl flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">Vehicle Fleet</p>
            <h1 className="mt-2 max-w-[760px] text-5xl font-heading font-semibold tracking-tight md:text-7xl">
              {selectedVehicle?.name}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {mode === 'detail' && (
              <Button variant="outline" onClick={openSelector}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Selector
              </Button>
            )}
            {canWrite && selectedVehicle && (
              <>
                <Button variant="outline" onClick={() => openEditDialog(selectedVehicle)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteVehicle(selectedVehicle)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </>
            )}
            {canWrite && (
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Vehicle
              </Button>
            )}
          </div>
        </div>

        <div
          ref={stageRef}
          className="relative mt-6 min-h-[650px] flex-1 overflow-visible"
          style={{
            minHeight: mode === 'detail'
              ? Math.max(650, 150 + Math.ceil((detailFields.length + 1) / 2) * 160)
              : 650,
          }}
        >
          <motion.button
            type="button"
            initial={false}
            animate={mode === 'detail' ? vehicleStage.detail : vehicleStage.selector}
            transition={VEHICLE_SPRING}
            onClick={() => {
              if (mode === 'selector') openSelectedDetails();
            }}
            onKeyDown={(event) => {
              if (mode === 'selector' && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                openSelectedDetails();
              }
            }}
            style={{
              width: vehicleStage.carWidth,
              height: vehicleStage.carHeight,
              pointerEvents: mode === 'selector' ? 'auto' : 'none',
              transformOrigin: 'top left',
            }}
            className={cn(
              "absolute left-0 top-0 z-30 flex items-center justify-center border-0 bg-transparent p-0 text-left outline-none will-change-transform",
              mode === 'selector' ? "cursor-pointer" : "cursor-default"
            )}
            aria-label={mode === 'selector' ? `View details for ${selectedVehicle.name}` : selectedVehicle.name}
          >
            <div className="absolute bottom-5 left-1/2 h-12 w-3/4 -translate-x-1/2 rounded-full bg-black/20 blur-2xl dark:bg-black/55" />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.img
                key={selectedVehicle.id}
                src={resolveVehicleFileUrl(selectedVehicle.imageUrl)}
                alt={selectedVehicle.name}
                initial={{ opacity: 0, scale: 0.985, filter: 'blur(12px) drop-shadow(0 24px 24px rgb(0 0 0 / 0.28))' }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  filter: carMotionBlur
                    ? 'blur(3px) drop-shadow(0 24px 24px rgb(0 0 0 / 0.28))'
                    : 'blur(0px) drop-shadow(0 24px 24px rgb(0 0 0 / 0.28))'
                }}
                exit={{ opacity: 0, scale: 1.015, filter: 'blur(10px) drop-shadow(0 24px 24px rgb(0 0 0 / 0.28))' }}
                transition={carMotionBlur ? { duration: 0.18, ease: 'easeOut' } : SOFT_FADE}
                className="relative z-10 max-h-[430px] w-full object-contain"
                draggable={false}
              />
            </AnimatePresence>
          </motion.button>

          <AnimatePresence initial={false}>
            {mode === 'selector' && (
              <motion.div
                key="selector-layer"
                initial={{ opacity: 0, scale: 0.992, filter: 'blur(9px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.992, filter: 'blur(9px)' }}
                transition={SOFT_FADE}
                className="absolute inset-0 z-20"
              >
                {previewFields.map((field, index) => (
                  <PreviewCard
                    key={field.id}
                    field={field}
                    value={selectedVehicle?.fieldValues?.[field.id]}
                    index={index}
                    position={previewCardPositions[index]}
                  />
                ))}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ ...SOFT_FADE, delay: 0.05 }}
                  className="absolute z-40 -translate-x-1/2"
                  style={selectorButtonPosition}
                >
                  <Button onClick={openSelectedDetails}>
                    View Details
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
                  transition={SOFT_FADE}
                  className="absolute inset-x-0 bottom-0 z-40 flex justify-center"
                >
                  <VehicleDock vehicles={vehicles} selectedVehicle={selectedVehicle} onSelect={handleSelect} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {mode === 'detail' && (
              <motion.div
                key="detail-layer"
                initial={{ opacity: 0, y: 18, scale: 0.992, filter: 'blur(12px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -14, scale: 0.992, filter: 'blur(12px)' }}
                transition={SOFT_FADE}
                className="absolute inset-x-0 top-[390px] z-20 pb-10 lg:left-[470px] lg:top-2"
              >
                <div className="grid content-start gap-4 sm:grid-cols-2">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SOFT_FADE, delay: 0.04 }}
                    className="rounded-2xl border border-white/10 bg-card/55 p-5 shadow-lg backdrop-blur-2xl sm:col-span-2"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vehicle</p>
                    <p className="mt-2 text-3xl font-heading font-semibold">{selectedVehicle.name}</p>
                  </motion.div>

                  {detailFields.map(field => (
                    <DetailFieldCard
                      key={field.id}
                      field={field}
                      value={selectedVehicle.fieldValues?.[field.id]}
                      onOpenFile={(selectedField, value) => setFilePreview({ field: selectedField, value })}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <VehicleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        vehicle={editingVehicle}
        fields={fields}
        onSaved={fetchData}
      />

      <AlertDialog open={Boolean(deleteVehicle)} onOpenChange={(open) => !open && setDeleteVehicle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes "{deleteVehicle?.name}" from the Vehicle Fleet. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVehicle} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(filePreview)} onOpenChange={(open) => !open && setFilePreview(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{filePreview?.field?.name || 'Vehicle Document'}</DialogTitle>
            <DialogDescription>{filePreview?.value?.filename || 'Uploaded vehicle photo'}</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[70vh] items-center justify-center rounded-2xl bg-muted/30 p-4">
            {filePreview?.value ? (
              <img
                src={getFileValueUrl(filePreview.value)}
                alt={filePreview?.field?.name || 'Vehicle document'}
                className="max-h-[64vh] w-full object-contain"
              />
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setFilePreview(null)}
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
