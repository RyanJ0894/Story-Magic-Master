import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Globe,
  Shield,
  Mail,
  Bell,
  CreditCard,
  Server,
  Database,
  Key,
} from 'lucide-react';

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-600 dark:text-slate-400">Manage platform configuration</p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-slate-600" />
              <div>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Platform name, branding, and general options</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="platform-name">Platform Name</Label>
              <Input id="platform-name" defaultValue="Story Magic" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="support-email">Support Email</Label>
              <Input id="support-email" type="email" defaultValue="support@storymagic.app" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">Temporarily disable user access</p>
              </div>
              <Switch />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-slate-600" />
              <div>
                <CardTitle>Security</CardTitle>
                <CardDescription>Authentication and access control settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Require Email Verification</Label>
                <p className="text-sm text-muted-foreground">New users must verify email</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Social Login</Label>
                <p className="text-sm text-muted-foreground">Enable Google/Apple sign in</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">Require 2FA for admin accounts</p>
              </div>
              <Switch />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="session-timeout">Session Timeout (hours)</Label>
              <Input id="session-timeout" type="number" defaultValue="24" className="w-32" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-slate-600" />
              <div>
                <CardTitle>Email Configuration</CardTitle>
                <CardDescription>Transactional email settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="from-email">From Email</Label>
              <Input id="from-email" type="email" defaultValue="noreply@storymagic.app" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="from-name">From Name</Label>
              <Input id="from-name" defaultValue="Story Magic" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Welcome Email</Label>
                <p className="text-sm text-muted-foreground">Send welcome email on signup</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-slate-600" />
              <div>
                <CardTitle>Admin Notifications</CardTitle>
                <CardDescription>Configure admin alerts and notifications</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>New User Signups</Label>
                <p className="text-sm text-muted-foreground">Get notified on new registrations</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>New Subscriptions</Label>
                <p className="text-sm text-muted-foreground">Get notified on new paid subscriptions</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Subscription Cancellations</Label>
                <p className="text-sm text-muted-foreground">Get notified when users cancel</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Failed Payments</Label>
                <p className="text-sm text-muted-foreground">Get notified on payment failures</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Billing Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-slate-600" />
              <div>
                <CardTitle>Billing & Payments</CardTitle>
                <CardDescription>Stripe and subscription settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Stripe Mode</Label>
                <p className="text-sm text-muted-foreground">Current payment environment</p>
              </div>
              <Badge variant={process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'default' : 'secondary'}>
                {process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'Live' : 'Test'}
              </Badge>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="trial-days">Trial Period (days)</Label>
              <Input id="trial-days" type="number" defaultValue="7" className="w-32" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Grace Period on Payment Failure</Label>
                <p className="text-sm text-muted-foreground">Days before suspending access</p>
              </div>
              <Input type="number" defaultValue="3" className="w-20" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* API & Integrations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-slate-600" />
              <div>
                <CardTitle>API & Integrations</CardTitle>
                <CardDescription>External service connections</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-white dark:bg-slate-800 flex items-center justify-center text-lg font-bold">
                  S
                </div>
                <div>
                  <p className="font-medium">Supabase</p>
                  <p className="text-sm text-muted-foreground">Database & Auth</p>
                </div>
              </div>
              <Badge variant="default">Connected</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-white dark:bg-slate-800 flex items-center justify-center text-lg font-bold">
                  11
                </div>
                <div>
                  <p className="font-medium">ElevenLabs</p>
                  <p className="text-sm text-muted-foreground">Text-to-Speech</p>
                </div>
              </div>
              <Badge variant={process.env.ELEVENLABS_API_KEY ? 'default' : 'destructive'}>
                {process.env.ELEVENLABS_API_KEY ? 'Connected' : 'Not Configured'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-white dark:bg-slate-800 flex items-center justify-center text-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium">Stripe</p>
                  <p className="text-sm text-muted-foreground">Payments</p>
                </div>
              </div>
              <Badge variant={process.env.STRIPE_SECRET_KEY ? 'default' : 'destructive'}>
                {process.env.STRIPE_SECRET_KEY ? 'Connected' : 'Not Configured'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-slate-600" />
              <div>
                <CardTitle>System Information</CardTitle>
                <CardDescription>Platform version and deployment info</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Version</p>
                <p className="font-medium">1.0.0-beta</p>
              </div>
              <div>
                <p className="text-muted-foreground">Environment</p>
                <p className="font-medium">{process.env.NODE_ENV}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Node.js</p>
                <p className="font-medium">{process.version || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Admin User</p>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
