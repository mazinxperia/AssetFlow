import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Music, Pause, Play, Shuffle, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
  AlertDialogTrigger
} from '../ui/alert-dialog';
import { settingsAPI } from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { cn } from '../../lib/utils';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatSize(size) {
  if (!size) return '0 MB';
  return `${(size / 1024 / 1024).toFixed(size >= 1024 * 1024 ? 1 : 2)} MB`;
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
}

export function AppMusicSettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [trackName, setTrackName] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [editNames, setEditNames] = useState({});

  const selectedFileLabel = useMemo(() => {
    if (!file) return 'No MP3 selected';
    return `${file.name} - ${formatSize(file.size)}`;
  }, [file]);

  useEffect(() => {
    loadMusicSettings();
  }, []);

  async function loadMusicSettings() {
    setLoading(true);
    try {
      const response = await settingsAPI.getMusic();
      const nextTracks = response.data?.tracks || [];
      setEnabled(Boolean(response.data?.enabled));
      setTracks(nextTracks);
      setEditNames(Object.fromEntries(nextTracks.map(track => [track.id, track.name])));
    } catch (error) {
      toast.error('Failed to load app music settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnabledChange(value) {
    setEnabled(value);
    setSavingEnabled(true);
    try {
      await settingsAPI.updateMusic({ enabled: value });
      toast.success(value ? 'App music enabled' : 'App music disabled');
    } catch (error) {
      setEnabled(prev => !prev);
      toast.error('Failed to update app music mode');
    } finally {
      setSavingEnabled(false);
    }
  }

  function handleFileChange(nextFile) {
    if (!nextFile) return;
    const isMp3 = nextFile.name.toLowerCase().endsWith('.mp3') || nextFile.type === 'audio/mpeg';
    if (!isMp3) {
      toast.error('Please select an MP3 file');
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      toast.error('Music file must be 50 MB or smaller');
      return;
    }
    setFile(nextFile);
    if (!trackName.trim()) {
      setTrackName(nextFile.name.replace(/\.mp3$/i, ''));
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!trackName.trim()) {
      toast.error('Enter a music name');
      return;
    }
    if (!file) {
      toast.error('Choose an MP3 file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('name', trackName.trim());
      formData.append('file', file);
      const response = await settingsAPI.uploadMusicTrack(formData);
      const nextTrack = response.data;
      setTracks(prev => [...prev, nextTrack]);
      setEditNames(prev => ({ ...prev, [nextTrack.id]: nextTrack.name }));
      setTrackName('');
      setFile(null);
      const input = document.getElementById('music-file-upload');
      if (input) input.value = '';
      toast.success('Music uploaded');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload music');
    } finally {
      setUploading(false);
    }
  }

  async function handleRename(track) {
    const nextName = (editNames[track.id] || '').trim();
    if (!nextName) {
      toast.error('Music name cannot be empty');
      return;
    }
    if (nextName === track.name) return;

    setRenamingId(track.id);
    try {
      const response = await settingsAPI.renameMusicTrack(track.id, { name: nextName });
      setTracks(prev => prev.map(item => item.id === track.id ? response.data : item));
      toast.success('Music name updated');
    } catch (error) {
      toast.error('Failed to rename music');
    } finally {
      setRenamingId(null);
    }
  }

  async function handleDelete(track) {
    setDeletingId(track.id);
    try {
      await settingsAPI.deleteMusicTrack(track.id);
      setTracks(prev => prev.filter(item => item.id !== track.id));
      setEditNames(prev => {
        const next = { ...prev };
        delete next[track.id];
        return next;
      });
      toast.success('Music deleted');
    } catch (error) {
      toast.error('Failed to delete music');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            App Music
          </CardTitle>
          <CardDescription>
            Add a small global music player for the whole app. Changes apply to all users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-lg border bg-secondary/30 p-4">
            <div>
              <div className="flex items-center gap-2 font-medium">
                {enabled ? <Play className="w-4 h-4 text-primary" /> : <Pause className="w-4 h-4 text-muted-foreground" />}
                Music Player Mode
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Shows the floating player when at least one song is uploaded.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {savingEnabled && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={enabled}
                onCheckedChange={handleEnabledChange}
                disabled={savingEnabled}
                data-testid="music-enabled-switch"
              />
            </div>
          </div>

          <form onSubmit={handleUpload} className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              <h3 className="font-medium">Upload Music</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div>
                <Label htmlFor="music-name">Music Name</Label>
                <Input
                  id="music-name"
                  value={trackName}
                  onChange={(event) => setTrackName(event.target.value)}
                  placeholder="e.g. Morning Flow"
                  className="mt-2"
                  maxLength={80}
                  data-testid="music-name-input"
                />
              </div>
              <div className="md:w-64">
                <Label>MP3 File</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full justify-start"
                  onClick={() => document.getElementById('music-file-upload')?.click()}
                  disabled={uploading}
                  data-testid="music-file-button"
                >
                  <Upload className="w-4 h-4" />
                  Choose MP3
                </Button>
                <input
                  id="music-file-upload"
                  type="file"
                  accept="audio/mpeg,.mp3"
                  className="hidden"
                  onChange={(event) => handleFileChange(event.target.files?.[0])}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className={cn("text-sm", file ? "text-foreground" : "text-muted-foreground")}>
                {selectedFileLabel}
              </p>
              <Button type="submit" disabled={uploading || !file || !trackName.trim()} data-testid="upload-music-btn">
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Music
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              MP3 only. Maximum file size is 50 MB.
            </p>
          </form>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">Music Library</h3>
              <span className="text-sm text-muted-foreground">{tracks.length} song{tracks.length === 1 ? '' : 's'}</span>
            </div>

            {tracks.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Music className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">No music uploaded yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload an MP3 and enable player mode to show the floating player.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tracks.map(track => (
                  <div key={track.id} className="rounded-lg border bg-card p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Shuffle className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Input
                          value={editNames[track.id] ?? track.name}
                          onChange={(event) => setEditNames(prev => ({ ...prev, [track.id]: event.target.value }))}
                          onBlur={() => handleRename(track)}
                          className="font-medium"
                          maxLength={80}
                          data-testid={`music-track-name-${track.id}`}
                        />
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
                          <span className="truncate max-w-[220px]">{track.filename}</span>
                          <span>{formatSize(track.size)}</span>
                          {formatDate(track.createdAt) && <span>{formatDate(track.createdAt)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:self-start">
                        {renamingId === track.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deletingId === track.id}
                              className="text-muted-foreground hover:text-destructive"
                              data-testid={`delete-music-track-${track.id}`}
                            >
                              {deletingId === track.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete music?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes "{track.name}" from the app music library. The floating player will stop using it immediately.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(track)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
