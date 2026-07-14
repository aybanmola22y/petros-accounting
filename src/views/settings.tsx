"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Coins,
  Users,
  Bell,
  Plug,
  ShieldCheck,
  Save,
  UserPlus,
  Trash2,
  CheckCircle2,
  Upload,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuickBooksImport } from "@/views/quickbooks-import";
import { CreateUserDialog } from "@/components/create-user-dialog";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import type { AppUser, UserRole } from "@/lib/users/types";
import { USER_ROLES } from "@/lib/users/types";

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState({
    invoicePaid: true,
    billDue: true,
    weeklySummary: true,
    lowBalance: false,
    productUpdates: false,
  });

  const [security, setSecurity] = useState({
    twoFactor: false,
    loginAlerts: true,
  });

  const [teamMembers, setTeamMembers] = useState<AppUser[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  const loadUsers = useCallback(async () => {
    setTeamLoading(true);
    try {
      const response = await fetch("/api/users");
      const payload = (await response.json()) as {
        users?: AppUser[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load users.");
      }
      setTeamMembers(payload.users ?? []);
    } catch (error) {
      console.warn("Could not load users from Supabase.", error);
      // Fallback so Settings still shows the signed-in person before migration.
      if (user) {
        setTeamMembers([
          {
            id: "local-current",
            email: user.email,
            name: user.name,
            role: (user.role as UserRole) || "Super Admin",
            status: "Active",
            lastLoginAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);
      } else {
        setTeamMembers([]);
      }
    } finally {
      setTeamLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const integrations = [
    { name: "QuickBooks Online", description: "Import chart of accounts and transactions.", connected: true },
    { name: "Bank Feeds (Plaid)", description: "Automatically sync bank & credit card transactions.", connected: true },
    { name: "Stripe", description: "Accept online invoice payments.", connected: false },
    { name: "Google Workspace", description: "Single sign-on and calendar sync.", connected: false },
  ];

  const notify = (section: string) =>
    toast({ title: "Settings saved", description: `${section} has been updated.` });

  async function handleRoleChange(member: AppUser, role: UserRole) {
    if (member.id === "local-current") return;
    try {
      const response = await fetch(`/api/users/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const payload = (await response.json()) as { user?: AppUser; error?: string };
      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? "Could not update role.");
      }
      setTeamMembers((prev) =>
        prev.map((m) => (m.id === member.id ? payload.user! : m)),
      );
      toast({ title: "Role updated", description: `${member.name} is now ${role}.` });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  async function handleRemoveUser(member: AppUser) {
    if (member.id === "local-current") return;
    try {
      const response = await fetch(`/api/users/${member.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not remove user.");
      }
      setTeamMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast({
        title: "Member removed",
        description: `${member.name} no longer has access.`,
      });
    } catch (error) {
      toast({
        title: "Remove failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your company profile, financial preferences, team, and integrations.
        </p>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="h-4 w-4" /> Company
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5">
            <Coins className="h-4 w-4" /> Financial
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="h-4 w-4" /> Users &amp; Roles
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="h-4 w-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5">
            <Plug className="h-4 w-4" /> Integrations
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5">
            <Upload className="h-4 w-4" /> Import
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Security
          </TabsTrigger>
        </TabsList>

        {/* Company Profile */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Company Profile
              </CardTitle>
              <CardDescription>
                This information appears on invoices, reports, and other documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company name</Label>
                  <Input id="company-name" defaultValue="Petrosphere Inc." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legal-name">Legal / registered name</Label>
                  <Input id="legal-name" defaultValue="Petrosphere Incorporated" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax-id">Tax ID / TIN</Label>
                  <Input id="tax-id" defaultValue="000-123-456-000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input id="industry" defaultValue="Oil & Gas Services" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email">Contact email</Label>
                  <Input id="company-email" type="email" defaultValue="accounts@petrosphere.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Phone</Label>
                  <Input id="company-phone" defaultValue="+63 2 8123 4567" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="company-address">Business address</Label>
                  <Input id="company-address" defaultValue="Unit 10A, Petro Tower, Makati City, Metro Manila, Philippines" />
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => notify("Company profile")}>
                  <Save className="h-4 w-4" /> Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Preferences */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-4 w-4" /> Financial Preferences
              </CardTitle>
              <CardDescription>
                Defaults used across accounting, invoicing, and reporting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Base currency</Label>
                  <Select defaultValue="PHP">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PHP">PHP — Philippine Peso</SelectItem>
                      <SelectItem value="USD">USD — US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR — Euro</SelectItem>
                      <SelectItem value="SGD">SGD — Singapore Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fiscal year start</Label>
                  <Select defaultValue="jan">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jan">January</SelectItem>
                      <SelectItem value="apr">April</SelectItem>
                      <SelectItem value="jul">July</SelectItem>
                      <SelectItem value="oct">October</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date format</Label>
                  <Select defaultValue="mdy">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                      <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                      <SelectItem value="ymd">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax-rate">Default tax rate (%)</Label>
                  <Input id="tax-rate" type="number" defaultValue="12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-prefix">Invoice number prefix</Label>
                  <Input id="invoice-prefix" defaultValue="INV-" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-terms">Default payment terms</Label>
                  <Select defaultValue="net30">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="due">Due on receipt</SelectItem>
                      <SelectItem value="net15">Net 15</SelectItem>
                      <SelectItem value="net30">Net 30</SelectItem>
                      <SelectItem value="net60">Net 60</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => notify("Financial preferences")}>
                  <Save className="h-4 w-4" /> Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users & Roles */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Users &amp; Roles
                </CardTitle>
                <CardDescription>Manage who can access this accounting system.</CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => setCreateUserOpen(true)}
              >
                <UserPlus className="h-4 w-4" /> Create user
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {teamLoading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
                </div>
              ) : teamMembers.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">
                  No users yet. Create one to start tracking accounts in Supabase.
                </p>
              ) : (
                teamMembers.map((member, i) => (
                <div key={member.id}>
                  <div className="flex items-center gap-3 py-3">
                    <Avatar className="h-9 w-9 border">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {member.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{member.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <div className="hidden w-36 sm:block">
                      <Select
                        value={member.role}
                        disabled={member.role === "Super Admin"}
                        onValueChange={(v) => void handleRoleChange(member, v as UserRole)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {USER_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Badge
                      variant={member.status === "Active" ? "secondary" : "outline"}
                      className={
                        member.status === "Active"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : member.status === "Disabled"
                            ? "text-muted-foreground"
                            : "text-amber-700 border-amber-200 bg-amber-50"
                      }
                    >
                      {member.status}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      disabled={member.role === "Super Admin"}
                      aria-label={`Remove ${member.name}`}
                      onClick={() => void handleRemoveUser(member)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {i < teamMembers.length - 1 ? <Separator /> : null}
                </div>
              ))
              )}
            </CardContent>
          </Card>
          <CreateUserDialog
            open={createUserOpen}
            onOpenChange={setCreateUserOpen}
            onCreated={(created) => {
              setTeamMembers((prev) => [...prev.filter((m) => m.id !== "local-current"), created]);
              void loadUsers();
            }}
          />
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" /> Notifications
              </CardTitle>
              <CardDescription>Choose which email alerts you want to receive.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                <SettingRow title="Invoice paid" description="Get notified when a customer pays an invoice.">
                  <Switch
                    checked={notifications.invoicePaid}
                    onCheckedChange={(v) => setNotifications((s) => ({ ...s, invoicePaid: v }))}
                  />
                </SettingRow>
                <SettingRow title="Bill due reminders" description="Reminders before a bill's due date.">
                  <Switch
                    checked={notifications.billDue}
                    onCheckedChange={(v) => setNotifications((s) => ({ ...s, billDue: v }))}
                  />
                </SettingRow>
                <SettingRow title="Weekly summary" description="A weekly digest of cash flow and activity.">
                  <Switch
                    checked={notifications.weeklySummary}
                    onCheckedChange={(v) => setNotifications((s) => ({ ...s, weeklySummary: v }))}
                  />
                </SettingRow>
                <SettingRow title="Low balance alerts" description="Alert when a bank account drops below a threshold.">
                  <Switch
                    checked={notifications.lowBalance}
                    onCheckedChange={(v) => setNotifications((s) => ({ ...s, lowBalance: v }))}
                  />
                </SettingRow>
                <SettingRow title="Product updates" description="News about new features and improvements.">
                  <Switch
                    checked={notifications.productUpdates}
                    onCheckedChange={(v) => setNotifications((s) => ({ ...s, productUpdates: v }))}
                  />
                </SettingRow>
              </div>
              <Separator className="my-4" />
              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => notify("Notification preferences")}>
                  <Save className="h-4 w-4" /> Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-4 w-4" /> Integrations
              </CardTitle>
              <CardDescription>Connect the tools you use to keep your books in sync.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="flex items-center justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{integration.name}</p>
                      {integration.connected ? (
                        <Badge className="gap-1 bg-emerald-100 text-emerald-800 border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Connected
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={integration.connected ? "outline" : "default"}
                    onClick={() =>
                      toast({
                        title: integration.connected ? "Disconnected" : "Connected",
                        description: `${integration.name} was ${integration.connected ? "disconnected" : "connected"}.`,
                      })
                    }
                  >
                    {integration.connected ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import from QuickBooks */}
        <TabsContent value="import" className="space-y-6">
          <QuickBooksImport />
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Security
              </CardTitle>
              <CardDescription>Keep your account and company data protected.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input id="current-password" type="password" placeholder="••••••••" />
                </div>
                <div className="hidden md:block" />
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input id="new-password" type="password" placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input id="confirm-password" type="password" placeholder="••••••••" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" className="gap-2" onClick={() => notify("Password")}>
                  <Save className="h-4 w-4" /> Update password
                </Button>
              </div>

              <Separator />

              <div className="divide-y">
                <SettingRow
                  title="Two-factor authentication"
                  description="Require a verification code at sign-in for extra security."
                >
                  <Switch
                    checked={security.twoFactor}
                    onCheckedChange={(v) => setSecurity((s) => ({ ...s, twoFactor: v }))}
                  />
                </SettingRow>
                <SettingRow
                  title="Login alerts"
                  description="Email me when a new device signs in to my account."
                >
                  <Switch
                    checked={security.loginAlerts}
                    onCheckedChange={(v) => setSecurity((s) => ({ ...s, loginAlerts: v }))}
                  />
                </SettingRow>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
