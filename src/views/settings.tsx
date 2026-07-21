"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  CheckCircle2,
  Coins,
  Loader2,
  Plug,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { CreateUserDialog } from "@/components/create-user-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import type { AppUser, UserRole } from "@/lib/users/types";
import { USER_ROLES } from "@/lib/users/types";
import { cn } from "@/lib/utils";
import { QuickBooksImport } from "@/views/quickbooks-import";

function SettingsPanel({
  title,
  description,
  action,
  children,
  footer,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-white">
      <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/30 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer ? (
        <div className="flex justify-end border-t border-border/70 bg-muted/20 px-5 py-3">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function Field({
  id,
  label,
  children,
  className,
}: {
  id?: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
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
  const [userToRemove, setUserToRemove] = useState<AppUser | null>(null);
  const [removingUser, setRemovingUser] = useState(false);

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
    {
      name: "QuickBooks Online",
      description: "Import chart of accounts and transactions.",
      connected: true,
    },
    {
      name: "Bank Feeds (Plaid)",
      description: "Automatically sync bank & credit card transactions.",
      connected: true,
    },
    {
      name: "Stripe",
      description: "Accept online invoice payments.",
      connected: false,
    },
    {
      name: "Google Workspace",
      description: "Single sign-on and calendar sync.",
      connected: false,
    },
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
    setRemovingUser(true);
    try {
      const response = await fetch(`/api/users/${member.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not remove user.");
      }
      setTeamMembers((prev) => prev.filter((m) => m.id !== member.id));
      setUserToRemove(null);
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
    } finally {
      setRemovingUser(false);
    }
  }

  const saveButton = (label: string, section: string) => (
    <Button size="sm" className="h-9 gap-2" onClick={() => notify(section)}>
      <Save className="h-3.5 w-3.5" />
      {label}
    </Button>
  );

  return (
    <div className="w-full space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Company profile, financial defaults, team access, and integrations.
        </p>
      </div>

      <Tabs defaultValue="company" className="space-y-5">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-border/80 bg-white p-1.5 shadow-none">
          {(
            [
              { value: "company", label: "Company", icon: Building2 },
              { value: "preferences", label: "Financial", icon: Coins },
              { value: "team", label: "Users & Roles", icon: Users },
              { value: "notifications", label: "Notifications", icon: Bell },
              { value: "integrations", label: "Integrations", icon: Plug },
              { value: "import", label: "Import", icon: Upload },
              { value: "security", label: "Security", icon: ShieldCheck },
            ] as const
          ).map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-1.5 rounded-lg px-3 py-2 text-sm data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="company" className="mt-0">
          <SettingsPanel
            title="Company profile"
            description="Shown on invoices, reports, and other documents."
            footer={saveButton("Save changes", "Company profile")}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field id="company-name" label="Company name">
                <Input id="company-name" defaultValue="Petrosphere Inc." />
              </Field>
              <Field id="legal-name" label="Legal / registered name">
                <Input id="legal-name" defaultValue="Petrosphere Incorporated" />
              </Field>
              <Field id="tax-id" label="Tax ID / TIN">
                <Input id="tax-id" defaultValue="000-123-456-000" />
              </Field>
              <Field id="industry" label="Industry">
                <Input id="industry" defaultValue="Oil & Gas Services" />
              </Field>
              <Field id="company-email" label="Contact email">
                <Input
                  id="company-email"
                  type="email"
                  defaultValue="accounts@petrosphere.com"
                />
              </Field>
              <Field id="company-phone" label="Phone">
                <Input id="company-phone" defaultValue="+63 2 8123 4567" />
              </Field>
              <Field id="company-address" label="Business address" className="md:col-span-2 xl:col-span-3">
                <Input
                  id="company-address"
                  defaultValue="Unit 10A, Petro Tower, Makati City, Metro Manila, Philippines"
                />
              </Field>
            </div>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="preferences" className="mt-0">
          <SettingsPanel
            title="Financial preferences"
            description="Defaults used across accounting, invoicing, and reporting."
            footer={saveButton("Save changes", "Financial preferences")}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Base currency">
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
              </Field>
              <Field label="Fiscal year start">
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
              </Field>
              <Field label="Date format">
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
              </Field>
              <Field id="tax-rate" label="Default tax rate (%)">
                <Input id="tax-rate" type="number" defaultValue="12" />
              </Field>
              <Field id="invoice-prefix" label="Invoice number prefix">
                <Input id="invoice-prefix" defaultValue="INV-" />
              </Field>
              <Field label="Default payment terms">
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
              </Field>
            </div>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="team" className="mt-0 space-y-0">
          <SettingsPanel
            title="Users & roles"
            description="Manage who can access this accounting system."
            action={
              <Button
                size="sm"
                className="h-9 gap-2"
                onClick={() => setCreateUserOpen(true)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Create user
              </Button>
            }
          >
            {teamLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
              </div>
            ) : teamMembers.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">
                No users yet. Create one to start tracking accounts in Supabase.
              </p>
            ) : (
              <div className="-mx-5 -my-5 overflow-hidden">
                <div className="hidden border-b border-border/70 bg-muted/20 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground lg:grid lg:grid-cols-[minmax(14rem,1.4fr)_12rem_7rem_2.5rem] lg:gap-4">
                  <span>User</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span className="sr-only">Actions</span>
                </div>
                <div className="divide-y divide-border/70">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center lg:grid lg:grid-cols-[minmax(14rem,1.4fr)_12rem_7rem_2.5rem] lg:gap-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                            {member.name
                              .split(" ")
                              .slice(0, 2)
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{member.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="w-full sm:w-44 lg:w-auto">
                        <Select
                          value={member.role}
                          disabled={member.role === "Super Admin"}
                          onValueChange={(v) => void handleRoleChange(member, v as UserRole)}
                        >
                          <SelectTrigger className="h-9">
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
                      <div className="flex items-center justify-between gap-3 lg:contents">
                        <Badge
                          variant={member.status === "Active" ? "secondary" : "outline"}
                          className={cn(
                            "w-fit",
                            member.status === "Active"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : member.status === "Disabled"
                                ? "text-muted-foreground"
                                : "border-amber-200 bg-amber-50 text-amber-700",
                          )}
                        >
                          {member.status}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={member.role === "Super Admin"}
                          aria-label={`Remove ${member.name}`}
                          onClick={() => setUserToRemove(member)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SettingsPanel>
          <CreateUserDialog
            open={createUserOpen}
            onOpenChange={setCreateUserOpen}
            onCreated={(created) => {
              setTeamMembers((prev) => [
                ...prev.filter((m) => m.id !== "local-current"),
                created,
              ]);
              void loadUsers();
            }}
          />
          <AlertDialog
            open={userToRemove !== null}
            onOpenChange={(open) => {
              if (!open && !removingUser) setUserToRemove(null);
            }}
          >
            <AlertDialogContent className="max-w-md gap-4 sm:rounded-lg">
              <AlertDialogTitle>Remove user?</AlertDialogTitle>
              <AlertDialogDescription className="text-[15px] leading-relaxed">
                {userToRemove ? (
                  <>
                    This will remove{" "}
                    <span className="font-medium text-foreground">{userToRemove.name}</span>
                    {" "}({userToRemove.email}) from the accounting system. They will no longer
                    be able to sign in. This can&apos;t be undone.
                  </>
                ) : null}
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={removingUser}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={removingUser || !userToRemove}
                  onClick={(event) => {
                    event.preventDefault();
                    if (userToRemove) void handleRemoveUser(userToRemove);
                  }}
                >
                  {removingUser ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Removing…
                    </>
                  ) : (
                    "Remove user"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          <SettingsPanel
            title="Notifications"
            description="Choose which email alerts you want to receive."
            footer={saveButton("Save changes", "Notification preferences")}
          >
            <div className="-my-1 divide-y divide-border/70">
              <SettingRow
                title="Invoice paid"
                description="Get notified when a customer pays an invoice."
              >
                <Switch
                  checked={notifications.invoicePaid}
                  onCheckedChange={(v) =>
                    setNotifications((s) => ({ ...s, invoicePaid: v }))
                  }
                />
              </SettingRow>
              <SettingRow
                title="Bill due reminders"
                description="Reminders before a bill's due date."
              >
                <Switch
                  checked={notifications.billDue}
                  onCheckedChange={(v) => setNotifications((s) => ({ ...s, billDue: v }))}
                />
              </SettingRow>
              <SettingRow
                title="Weekly summary"
                description="A weekly digest of cash flow and activity."
              >
                <Switch
                  checked={notifications.weeklySummary}
                  onCheckedChange={(v) =>
                    setNotifications((s) => ({ ...s, weeklySummary: v }))
                  }
                />
              </SettingRow>
              <SettingRow
                title="Low balance alerts"
                description="Alert when a bank account drops below a threshold."
              >
                <Switch
                  checked={notifications.lowBalance}
                  onCheckedChange={(v) =>
                    setNotifications((s) => ({ ...s, lowBalance: v }))
                  }
                />
              </SettingRow>
              <SettingRow
                title="Product updates"
                description="News about new features and improvements."
              >
                <Switch
                  checked={notifications.productUpdates}
                  onCheckedChange={(v) =>
                    setNotifications((s) => ({ ...s, productUpdates: v }))
                  }
                />
              </SettingRow>
            </div>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="integrations" className="mt-0">
          <SettingsPanel
            title="Integrations"
            description="Connect the tools you use to keep your books in sync."
          >
            <div className="-mx-5 -my-5 divide-y divide-border/70">
              {integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{integration.name}</p>
                      {integration.connected ? (
                        <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                          Not connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{integration.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={integration.connected ? "outline" : "default"}
                    className="h-9 shrink-0 self-start"
                    onClick={() =>
                      toast({
                        title: integration.connected ? "Disconnected" : "Connected",
                        description: `${integration.name} was ${
                          integration.connected ? "disconnected" : "connected"
                        }.`,
                      })
                    }
                  >
                    {integration.connected ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              ))}
            </div>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="import" className="mt-0">
          <QuickBooksImport />
        </TabsContent>

        <TabsContent value="security" className="mt-0 space-y-5">
          <SettingsPanel
            title="Password"
            description="Update the password used to sign in to your account."
            footer={
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-2"
                onClick={() => notify("Password")}
              >
                <Save className="h-3.5 w-3.5" />
                Update password
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field id="current-password" label="Current password">
                <Input id="current-password" type="password" placeholder="••••••••" />
              </Field>
              <Field id="new-password" label="New password">
                <Input id="new-password" type="password" placeholder="••••••••" />
              </Field>
              <Field id="confirm-password" label="Confirm new password">
                <Input id="confirm-password" type="password" placeholder="••••••••" />
              </Field>
            </div>
          </SettingsPanel>

          <SettingsPanel
            title="Account protection"
            description="Extra controls to keep company data protected."
          >
            <div className="-my-1 divide-y divide-border/70">
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
          </SettingsPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
