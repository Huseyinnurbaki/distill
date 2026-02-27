'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, GitBranch } from 'lucide-react';
import { signOut } from 'next-auth/react';

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-amber-100">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Pending Approval</CardTitle>
          <CardDescription>
            Your account is awaiting administrator approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 space-y-2">
            <p>
              Your Google account has been registered successfully.
            </p>
            <p>
              An administrator needs to approve your account before you can access Distill.
            </p>
            <p className="font-medium text-slate-900">
              Please contact your administrator to request access.
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
