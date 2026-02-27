'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Key, Check, X, KeyRound, UserCheck, UserX, Clock, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface User {
  id: string;
  username: string;
  email: string;
  authProvider: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  chatCount: number;
}

export default function AdminUsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    isAdmin: false,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && (!currentUser || !currentUser.isAdmin)) {
      router.push('/repos');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (currentUser?.isAdmin) {
      fetchUsers();
    }
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers((data.users || []).map((u: any) => ({ ...u, chatCount: u._count?.chats ?? 0 })));
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const length = 16;
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
    toast.success('Password generated');
  };

  const generateNewPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const length = 16;
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
    toast.success('Password generated');
  };

  const openResetPasswordDialog = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setResetPasswordDialogOpen(true);
  };

  const handleApproveUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/approve`, {
        method: 'PATCH',
      });

      if (!res.ok) throw new Error('Failed to approve');

      toast.success('User approved');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to approve user');
    }
  };

  const handleRejectUser = async (userId: string) => {
    if (!confirm('Are you sure you want to reject this user?')) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to reject');

      toast.success('User rejected and removed');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to reject user');
    }
  };

  const handleToggleAdmin = async (userId: string, makeAdmin: boolean) => {
    const action = makeAdmin ? 'grant admin to' : 'revoke admin from';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      const res = await fetch(`/api/users/${userId}/admin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: makeAdmin }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update admin status');
      }

      toast.success(makeAdmin ? 'Admin granted' : 'Admin revoked');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset password');
      }

      toast.success('Password reset successfully');
      setResetPasswordDialogOpen(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create user');
      }

      toast.success('User created successfully');
      setDialogOpen(false);
      setFormData({
        username: '',
        email: '',
        password: '',
        isAdmin: false,
      });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/repos')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Repos
            </Button>
            <h1 className="text-xl font-bold text-slate-900">User Management</h1>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Provider</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Admin</TableHead>
                  <TableHead className="text-center">Chats</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                        {user.authProvider}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {user.isActive ? (
                        <span className="flex items-center justify-center gap-1 text-green-600 text-xs">
                          <Check className="w-4 h-4" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1 text-amber-600 text-xs">
                          <Clock className="w-4 h-4" />
                          Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.isAdmin ? (
                        <Check className="w-4 h-4 text-green-600 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm text-slate-700">
                      {user.chatCount}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {format(new Date(user.createdAt), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!user.isActive ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApproveUser(user.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <UserCheck className="w-3.5 h-3.5 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRejectUser(user.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <UserX className="w-3.5 h-3.5 mr-1" />
                              Reject
                            </Button>
                          </>
                        ) : (
                          <>
                            {user.authProvider === 'local' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openResetPasswordDialog(user)}
                              >
                                <KeyRound className="w-3.5 h-3.5 mr-1" />
                                Reset Password
                              </Button>
                            )}
                            {user.id !== currentUser?.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleAdmin(user.id, !user.isAdmin)}
                                className={user.isAdmin ? 'text-amber-600 hover:text-amber-700' : 'text-blue-600 hover:text-blue-700'}
                              >
                                {user.isAdmin ? (
                                  <>
                                    <ShieldOff className="w-3.5 h-3.5 mr-1" />
                                    Revoke Admin
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                                    Make Admin
                                  </>
                                )}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create User Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
              <DialogDescription>
                Add a new user to the system
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="johndoe"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type="text"
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generatePassword}
                    title="Generate secure password"
                  >
                    <Key className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Click the key icon to generate a secure password
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <Label htmlFor="isAdmin" className="font-medium cursor-pointer">
                    Administrator
                  </Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Can manage users and settings
                  </p>
                </div>
                <Switch
                  id="isAdmin"
                  checked={formData.isAdmin}
                  onCheckedChange={(checked) => setFormData({ ...formData, isAdmin: checked })}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create User'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Reset password for {selectedUser?.username}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="flex gap-2">
                  <Input
                    id="newPassword"
                    type="text"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateNewPassword}
                    title="Generate secure password"
                  >
                    <Key className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Click the key icon to generate a secure password
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setResetPasswordDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Resetting...' : 'Reset Password'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
