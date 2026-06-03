import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Palette, Moon, Sun, Image, Upload, X, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { settingsAPI, filesAPI, usersAPI } from '../../services/api';
import { toast } from 'sonner';

// Predefined accent color options
const accentColors = [
  { name: 'Indigo', value: '#4F46E5' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Pink', value: '#DB2777' },
  { name: 'Red', value: '#DC2626' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Green', value: '#16A34A' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Cyan', value: '#0891B2' },
];

export function PersonalizationSettings({ allowWallpaper = true }) {
  const { 
    theme, 
    setTheme,
    toggleTheme, 
    glassMode, 
    setGlassMode,
    toggleGlassMode, 
    accentColor, 
    setAccentColor,
    wallpaperUrl,
    setWallpaperUrl,
    reloadSettings,
  } = useTheme();
  const { isSuperAdmin, updateUserPreferences } = useAuth();
  const canManageWallpaper = allowWallpaper && isSuperAdmin;
  
  const [customColor, setCustomColor] = useState(accentColor);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wallpaperFileId, setWallpaperFileId] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await usersAPI.getPreferences();
      if (response.data) {
        if (response.data.theme) {
          setTheme(response.data.theme);
        }
        if (response.data.accentColor) {
          setAccentColor(response.data.accentColor);
          setCustomColor(response.data.accentColor);
        }
        if (typeof response.data.glassMode === 'boolean') {
          setGlassMode(response.data.glassMode);
        }
        if (response.data.wallpaperFileId) {
          setWallpaperFileId(response.data.wallpaperFileId);
          setWallpaperUrl(filesAPI.getUrl(response.data.wallpaperFileId));
        } else {
          setWallpaperFileId(null);
          setWallpaperUrl('');
        }
      }
    } catch (error) {
      console.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [setAccentColor, setGlassMode, setTheme, setWallpaperUrl]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleColorSelect = (color) => {
    setAccentColor(color);
    setCustomColor(color);
  };

  const handleCustomColorChange = (e) => {
    const color = e.target.value;
    setCustomColor(color);
    setAccentColor(color);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserPreferences({
        accentColor,
        glassMode,
        theme,
      });
      if (canManageWallpaper) {
        await settingsAPI.updateAppSettings({ wallpaperFileId });
        await reloadSettings?.();
      }
      toast.success('Personalization settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleWallpaperUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await filesAPI.upload(formData);
      const fileId = response.data.fileId;
      setWallpaperFileId(fileId);
      setWallpaperUrl(filesAPI.getUrl(fileId));
      toast.success('Wallpaper uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload wallpaper');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveWallpaper = () => {
    setWallpaperFileId(null);
    setWallpaperUrl('');
    toast.success('Wallpaper removed');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Personalization
          </CardTitle>
          <CardDescription>
            Customize the appearance of the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                Dark Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Toggle between light and dark theme
              </p>
            </div>
            <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} data-testid="dark-mode-toggle" />
          </div>

          {/* Accent Color Picker */}
          <div className="space-y-4 py-3 border-b">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Accent Color
              </Label>
              <p className="text-sm text-muted-foreground">
                Choose the primary accent color for the application
              </p>
            </div>
            
            {/* Color Grid */}
            <div className="flex flex-wrap gap-3">
              {accentColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleColorSelect(color.value)}
                  className="relative w-10 h-10 rounded-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background"
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                  data-testid={`color-${color.name.toLowerCase()}`}
                >
                  {accentColor === color.value && (
                    <Check className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
              
              {/* Custom Color Picker */}
              <div className="relative">
                <input
                  type="color"
                  value={customColor}
                  onChange={handleCustomColorChange}
                  className="w-10 h-10 rounded-lg cursor-pointer border-2 border-border"
                  title="Custom color"
                  data-testid="custom-color-picker"
                />
              </div>
            </div>
            
            {/* Live Preview */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <div 
                className="w-8 h-8 rounded-lg"
                style={{ backgroundColor: accentColor }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Live Preview</p>
                <p className="text-xs text-muted-foreground">Current accent: {accentColor}</p>
              </div>
              <Button size="sm" style={{ backgroundColor: accentColor }}>
                Sample Button
              </Button>
            </div>
          </div>

          {/* Glass Mode Toggle */}
          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Glass UI</Label>
              <p className="text-sm text-muted-foreground">
                Apply glassmorphism effect to cards and components
              </p>
            </div>
            <Switch checked={glassMode} onCheckedChange={toggleGlassMode} data-testid="glass-mode-toggle" />
          </div>

          {/* Wallpaper Upload */}
          {canManageWallpaper && glassMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3 py-3 border-b"
            >
              <Label className="text-base flex items-center gap-2">
                <Image className="w-4 h-4" />
                Background Wallpaper
              </Label>
              <p className="text-sm text-muted-foreground">
                Upload a custom wallpaper for glass mode (recommended 1920x1080)
              </p>
              
              {wallpaperUrl ? (
                <div className="space-y-3">
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                    <img 
                      src={wallpaperUrl} 
                      alt="Wallpaper" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={handleRemoveWallpaper}
                      className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    disabled={uploading}
                    onClick={() => document.getElementById('wallpaper-upload').click()}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Wallpaper
                      </>
                    )}
                  </Button>
                  <input
                    id="wallpaper-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleWallpaperUpload}
                  />
                </div>
              )}
            </motion.div>
          )}

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving || uploading} data-testid="save-personalization-btn">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
