import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, KeyRound, MoreHorizontal } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
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
import { usersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { toast } from 'sonner';

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full access including Settings' },
  { value: 'ADMIN', label: 'Admin', description: 'Can manage assets, employees, and transfers' },
  { value: 'USER', label: 'User', description: 'View-only access' },
];

export function UserManagementSettings() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userDialog, setUserDialog] = useState({ open: false, user: null });
  const [passwordDialog, setPasswordDialog] = useState({ open: false, user: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER'
  });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  const handleSaveUser = async () => {
    try {
      if (userDialog.user) {
        await usersAPI.update(userDialog.user.id, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role
        });
        toast.success('User updated');
      } else {
        await usersAPI.create(userForm);
        toast.success('User created');
      }
      fetchUsers();
      closeUserDialog();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save user');
    }
  };

  const handleResetPassword = async () => {
    try {
      await usersAPI.resetPassword(passwordDialog.user.id, newPassword);
      toast.success('Password reset successfully');
      closePasswordDialog();
    } catch (error) {
      toast.error('Failed to reset password');
    }
  };

  const handleDeleteUser = async () => {
    try {
      await usersAPI.delete(deleteDialog.user.id);
      setUsers(prev => prev.filter(u => u.id !== deleteDialog.user.id));
      toast.success('User deleted');
    } catch (error) {
      toast.error('Failed to delete user');
    } finally {
      setDeleteDialog({ open: false, user: null });
    }
  };

  const openUserDialog = (user = null) => {
    if (user) {
      setUserForm({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role
      });
    } else {
      setUserForm({ name: '', email: '', password: '', role: 'USER' });
    }
    setUserDialog({ open: true, user });
  };

  const closeUserDialog = () => {
    setUserDialog({ open: false, user: null });
    setUserForm({ name: '', email: '', password: '', role: 'USER' });
  };

  const closePasswordDialog = () => {
    setPasswordDialog({ open: false, user: null });
    setNewPassword('');
  };

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'default';
      case 'ADMIN': return 'secondary';
      case 'USER': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-semibold">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage system users and their roles
          </p>
        </div>
        <Button onClick={() => openUserDialog()} data-testid="add-user-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card className="dark:border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                <TableCell>
                  <div>
                    <div className="font-medium">{user.name}</div>
                    {user.id === currentUser?.id && (
                      <span className="text-xs text-muted-foreground">(You)</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {user.role.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`user-menu-${user.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openUserDialog(user)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPasswordDialog({ open: true, user })}>
                        <KeyRound className="w-4 h-4 mr-2" />
                        Reset Password
                      </DropdownMenuItem>
                      {user.id !== currentUser?.id && (
                        <DropdownMenuItem 
                          onClick={() => setDeleteDialog({ open: true, user })}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* User Dialog */}
      <Dialog open={userDialog.open} onOpenChange={(open) => !open && closeUserDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{userDialog.user ? 'Edit User' : 'New User'}</DialogTitle>
            <DialogDescription>
              {userDialog.user ? 'Update user details' : 'Create a new system user'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={userForm.name}
                onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                className="mt-2"
                data-testid="user-name-input"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                className="mt-2"
                data-testid="user-email-input"
              />
            </div>
            {!userDialog.user && (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                  className="mt-2"
                  data-testid="user-password-input"
                />
              </div>
            )}
            <div>
              <Label htmlFor="role">Role</Label>
              <Select 
                value={userForm.role} 
                onValueChange={(value) => setUserForm(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger className="mt-2" data-testid="user-role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeUserDialog}>Cancel</Button>
            <Button 
              onClick={handleSaveUser} 
              disabled={!userForm.name.trim() || !userForm.email.trim() || (!userDialog.user && !userForm.password)}
              data-testid="save-user-btn"
            >
              {userDialog.user ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={passwordDialog.open} onOpenChange={(open) => !open && closePasswordDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {passwordDialog.user?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-2"
              data-testid="new-password-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePasswordDialog}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={!newPassword} data-testid="reset-password-btn">
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, user: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.user?.name}</strong>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
