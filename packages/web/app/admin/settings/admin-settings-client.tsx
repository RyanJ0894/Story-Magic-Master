'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Globe,
  Shield,
  Mail,
  Bell,
  CreditCard,
  Server,
  Key,
  Loader2,
  ChevronDown,
} from 'lucide-react';

interface EnvInfo {
  stripeMode: 'live' | 'test';
  elevenLabsConnected: boolean;
  stripeConnected: boolean;
  nodeEnv: string;
  nodeVersion: string;
  userId: string;
}

// All setting keys used in the UI
const SETTING_KEYS = {
  // General
  platformName: 'platform_name',
  supportEmail: 'support_email',
  maintenanceMode: 'maintenance_mode',
  // Security
  requireEmailVerification: 'require_email_verification',
  allowSocialLogin: 'allow_social_login',
  twoFactorAuth: 'two_factor_auth',
  sessionTimeout: 'session_timeout',
  // Email
  fromEmail: 'from_email',
  fromName: 'from_name',
  welcomeEmail: 'welcome_email',
  // Notifications
  notifyNewSignups: 'notify_new_signups',
  notifyNewSubscriptions: 'notify_new_subscriptions',
  notifyCancellations: 'notify_cancellations',
  notifyFailedPayments: 'notify_failed_payments',
  // Billing
  trialDays: 'trial_days',
  gracePeriodDays: 'grace_period_days',
} as const;

type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

// Default values for all settings
const DEFAULTS: Record<SettingKey, string | boolean | number> = {
  [SETTING_KEYS.platformName]: 'Story Magic',
  [SETTING_KEYS.supportEmail]: 'support@storymagic.app',
  [SETTING_KEYS.maintenanceMode]: false,
  [SETTING_KEYS.requireEmailVerification]: true,
  [SETTING_KEYS.allowSocialLogin]: true,
  [SETTING_KEYS.twoFactorAuth]: false,
  [SETTING_KEYS.sessionTimeout]: 24,
  [SETTING_KEYS.fromEmail]: 'noreply@storymagic.app',
  [SETTING_KEYS.fromName]: 'Story Magic',
  [SETTING_KEYS.welcomeEmail]: true,
  [SETTING_KEYS.notifyNewSignups]: true,
  [SETTING_KEYS.notifyNewSubscriptions]: true,
  [SETTING_KEYS.notifyCancellations]: true,
  [SETTING_KEYS.notifyFailedPayments]: true,
  [SETTING_KEYS.trialDays]: 7,
  [SETTING_KEYS.gracePeriodDays]: 3,
};

// Group setting keys by section for saving
const SECTIONS = {
  general: [SETTING_KEYS.platformName, SETTING_KEYS.supportEmail, SETTING_KEYS.maintenanceMode],
  security: [SETTING_KEYS.requireEmailVerification, SETTING_KEYS.allowSocialLogin, SETTING_KEYS.twoFactorAuth, SETTING_KEYS.sessionTimeout],
  email: [SETTING_KEYS.fromEmail, SETTING_KEYS.fromName, SETTING_KEYS.welcomeEmail],
  notifications: [SETTING_KEYS.notifyNewSignups, SETTING_KEYS.notifyNewSubscriptions, SETTING_KEYS.notifyCancellations, SETTING_KEYS.notifyFailedPayments],
  billing: [SETTING_KEYS.trialDays, SETTING_KEYS.gracePeriodDays],
} as const;

type SectionName = keyof typeof SECTIONS;

export default function AdminSettingsClient({ envInfo }: { envInfo: EnvInfo }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<SectionName | null>(null);
  const [openSections, setOpenSections] = useState({
    general: true,
    security: false,
    email: false,
    notifications: false,
    billing: false,
  });
  const fetchedRef = useRef(false);

  const toggleSection = useCallback((section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Fetch settings on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchSettings() {
      try {
        const res = await fetch('/api/admin/settings');
        if (!res.ok) throw new Error('Failed to fetch settings');
        const data = await res.json();
        setSettings(data.settings ?? {});
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load settings. Using defaults.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [toast]);

  // Get a setting value with fallback to default
  const getSetting = useCallback(
    (key: SettingKey): string | boolean | number => {
      if (key in settings) {
        return settings[key] as string | boolean | number;
      }
      return DEFAULTS[key];
    },
    [settings]
  );

  // Update a setting in local state
  const updateSetting = useCallback((key: SettingKey, value: string | boolean | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Save a section of settings
  const saveSection = useCallback(
    async (section: SectionName) => {
      setSavingSection(section);
      const sectionKeys = SECTIONS[section];
      const payload: Record<string, unknown> = {};
      for (const key of sectionKeys) {
        payload[key] = getSetting(key);
      }

      try {
        const res = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: payload }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to save');
        }

        toast({
          title: 'Settings saved',
          description: `${section.charAt(0).toUpperCase() + section.slice(1)} settings updated successfully.`,
        });
      } catch (err) {
        toast({
          title: 'Error saving settings',
          description: err instanceof Error ? err.message : 'An unexpected error occurred.',
          variant: 'destructive',
        });
      } finally {
        setSavingSection(null);
      }
    },
    [getSetting, toast]
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage platform configuration</p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* General Settings */}
        <Collapsible open={openSections.general} onOpenChange={() => toggleSection('general')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg select-none">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>Platform name, branding, and general options</CardDescription>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${openSections.general ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="platform-name">Platform Name</Label>
                  <Input
                    id="platform-name"
                    value={String(getSetting(SETTING_KEYS.platformName))}
                    onChange={(e) => updateSetting(SETTING_KEYS.platformName, e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="support-email">Support Email</Label>
                  <Input
                    id="support-email"
                    type="email"
                    value={String(getSetting(SETTING_KEYS.supportEmail))}
                    onChange={(e) => updateSetting(SETTING_KEYS.supportEmail, e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">Temporarily disable user access</p>
                  </div>
                  <Switch
                    checked={Boolean(getSetting(SETTING_KEYS.maintenanceMode))}
                    onCheckedChange={(checked) => updateSetting(SETTING_KEYS.maintenanceMode, checked)}
                    aria-label="Toggle maintenance mode"
                  />
                </div>
                <SaveButton section="general" saving={savingSection} onSave={saveSection} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Security Settings */}
        <Collapsible open={openSections.security} onOpenChange={() => toggleSection('security')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg select-none">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Authentication and access control settings</CardDescription>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${openSections.security ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Email Verification</Label>
                    <p className="text-sm text-muted-foreground">New users must verify email</p>
                  </div>
                  <Switch
                    checked={Boolean(getSetting(SETTING_KEYS.requireEmailVerification))}
                    onCheckedChange={(checked) => updateSetting(SETTING_KEYS.requireEmailVerification, checked)}
                    aria-label="Toggle require email verification"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Social Login</Label>
                    <p className="text-sm text-muted-foreground">Enable Google/Apple sign in</p>
                  </div>
                  <Switch
                    checked={Boolean(getSetting(SETTING_KEYS.allowSocialLogin))}
                    onCheckedChange={(checked) => updateSetting(SETTING_KEYS.allowSocialLogin, checked)}
                    aria-label="Toggle allow social login"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Require 2FA for admin accounts</p>
                  </div>
                  <Switch
                    checked={Boolean(getSetting(SETTING_KEYS.twoFactorAuth))}
                    onCheckedChange={(checked) => updateSetting(SETTING_KEYS.twoFactorAuth, checked)}
                    aria-label="Toggle two-factor authentication"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="session-timeout">Session Timeout (hours)</Label>
                  <Input
                    id="session-timeout"
                    type="number"
                    value={String(getSetting(SETTING_KEYS.sessionTimeout))}
                    onChange={(e) => updateSetting(SETTING_KEYS.sessionTimeout, Number(e.target.value))}
                    className="w-32"
                  />
                </div>
                <SaveButton section="security" saving={savingSection} onSave={saveSection} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Email Settings */}
        <Collapsible open={openSections.email} onOpenChange={() => toggleSection('email')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg select-none">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <CardTitle>Email Configuration</CardTitle>
                    <CardDescription>Transactional email settings</CardDescription>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${openSections.email ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="from-email">From Email</Label>
                  <Input
                    id="from-email"
                    type="email"
                    value={String(getSetting(SETTING_KEYS.fromEmail))}
                    onChange={(e) => updateSetting(SETTING_KEYS.fromEmail, e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="from-name">From Name</Label>
                  <Input
                    id="from-name"
                    value={String(getSetting(SETTING_KEYS.fromName))}
                    onChange={(e) => updateSetting(SETTING_KEYS.fromName, e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Welcome Email</Label>
                    <p className="text-sm text-muted-foreground">Send welcome email on signup</p>
                  </div>
                  <Switch
                    checked={Boolean(getSetting(SETTING_KEYS.welcomeEmail))}
                    onCheckedChange={(checked) => updateSetting(SETTING_KEYS.welcomeEmail, checked)}
                    aria-label="Toggle welcome email on signup"
                  />
                </div>
                <SaveButton section="email" saving={savingSection} onSave={saveSection} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Notification Settings */}
        <Collapsible open={openSections.notifications} onOpenChange={() => toggleSection('notifications')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg select-none">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <CardTitle>Admin Notifications</CardTitle>
                    <CardDescription>Configure admin alerts and notifications</CardDescription>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${openSections.notifications ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>New User Signups</Label>
                    <p className="text-sm text-muted-foreground">Get notified on new registrations</p>
                  </div>
                  <Switch
                    checked={Boolean(getSetting(SETTING_KEYS.notifyNewSignups))}
                    onCheckedChange={(checked) => updateSetting(SETTING_KEYS.notifyNewSignups, checked)}
                    aria-label="Toggle new user signup notifications"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>New Subscriptions</Label>
                    <p className="text-sm text-muted-foreground">Get notified on new paid subscriptions</p>
                  </div>
                  <Switch
                    checked={Boolean(getSetting(SETTING_KEYS.notifyNewSubscriptions))}
                    onCheckedChange={(checked) => updateSetting(SETTING_KEYS.notifyNewSubscriptions, checked)}
                    aria-label="Toggle new subscription notifications"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Subscription Cancellations</Label>
                    <p className="text-sm text-muted-foreground">Get notified when users cancel</p>
                  </div>
                  <Switch
                    checked={Boolean(getSetting(SETTING_KEYS.notifyCancellations))}
                    onCheckedChange={(checked) => updateSetting(SETTING_KEYS.notifyCancellations, checked)}
                    aria-label="Toggle subscription cancellation notifications"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Failed Payments</Label>
                    <p className="text-sm text-muted-foreground">Get notified on payment failures</p>
                  </div>
                  <Switch
                    checked={Boolean(getSetting(SETTING_KEYS.notifyFailedPayments))}
                    onCheckedChange={(checked) => updateSetting(SETTING_KEYS.notifyFailedPayments, checked)}
                    aria-label="Toggle failed payment notifications"
                  />
                </div>
                <SaveButton section="notifications" saving={savingSection} onSave={saveSection} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Billing Settings */}
        <Collapsible open={openSections.billing} onOpenChange={() => toggleSection('billing')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg select-none">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <CardTitle>Billing & Payments</CardTitle>
                    <CardDescription>Stripe and subscription settings</CardDescription>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${openSections.billing ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Stripe Mode</Label>
                    <p className="text-sm text-muted-foreground">Current payment environment</p>
                  </div>
                  <Badge variant={envInfo.stripeMode === 'live' ? 'default' : 'secondary'}>
                    {envInfo.stripeMode === 'live' ? 'Live' : 'Test'}
                  </Badge>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="trial-days">Trial Period (days)</Label>
                  <Input
                    id="trial-days"
                    type="number"
                    value={String(getSetting(SETTING_KEYS.trialDays))}
                    onChange={(e) => updateSetting(SETTING_KEYS.trialDays, Number(e.target.value))}
                    className="w-32"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Grace Period on Payment Failure</Label>
                    <p className="text-sm text-muted-foreground">Days before suspending access</p>
                  </div>
                  <Input
                    type="number"
                    value={String(getSetting(SETTING_KEYS.gracePeriodDays))}
                    onChange={(e) => updateSetting(SETTING_KEYS.gracePeriodDays, Number(e.target.value))}
                    className="w-20"
                  />
                </div>
                <SaveButton section="billing" saving={savingSection} onSave={saveSection} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* API & Integrations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle>API & Integrations</CardTitle>
                <CardDescription>External service connections</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-card flex items-center justify-center text-lg font-bold">
                  C
                </div>
                <div>
                  <p className="font-medium">Clerk + Prisma</p>
                  <p className="text-sm text-muted-foreground">Auth & Database</p>
                </div>
              </div>
              <Badge variant="default">Connected</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-card flex items-center justify-center text-lg font-bold">
                  11
                </div>
                <div>
                  <p className="font-medium">ElevenLabs</p>
                  <p className="text-sm text-muted-foreground">Text-to-Speech</p>
                </div>
              </div>
              <Badge variant={envInfo.elevenLabsConnected ? 'default' : 'destructive'}>
                {envInfo.elevenLabsConnected ? 'Connected' : 'Not Configured'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-card flex items-center justify-center text-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium">Stripe</p>
                  <p className="text-sm text-muted-foreground">Payments</p>
                </div>
              </div>
              <Badge variant={envInfo.stripeConnected ? 'default' : 'destructive'}>
                {envInfo.stripeConnected ? 'Connected' : 'Not Configured'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-muted-foreground" />
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
                <p className="font-medium">{envInfo.nodeEnv}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Node.js</p>
                <p className="font-medium">{envInfo.nodeVersion}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Admin User</p>
                <p className="font-medium">{envInfo.userId}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Per-section save button with loading state */
function SaveButton({
  section,
  saving,
  onSave,
}: {
  section: SectionName;
  saving: SectionName | null;
  onSave: (section: SectionName) => Promise<void>;
}) {
  const isSaving = saving === section;
  const isOtherSaving = saving !== null && saving !== section;

  return (
    <Button
      onClick={() => onSave(section)}
      disabled={isSaving || isOtherSaving}
    >
      {isSaving ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Saving...
        </>
      ) : (
        'Save Changes'
      )}
    </Button>
  );
}
