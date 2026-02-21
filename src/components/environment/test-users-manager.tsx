"use client"

import { useState, useCallback } from "react"
import { createTestUser, updateTestUser, deleteTestUser } from "@/app/actions/test-users"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Plus,
  Loader2,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Mail,
  KeyRound,
  UserCog,
  Info
} from "lucide-react"
import type { TestUser } from "@/lib/types"

interface TestUsersManagerProps {
  environmentId: string
  environmentName: string
  testUsers: TestUser[]
}

const COMMON_ROLES = [
  { value: "admin", label: "Admin", icon: ShieldCheck, color: "bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800" },
  { value: "member", label: "Member", icon: Shield, color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800" },
  { value: "viewer", label: "Viewer", icon: Eye, color: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800" },
  { value: "guest", label: "Guest", icon: UserCog, color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800" },
  { value: "manager", label: "Manager", icon: ShieldAlert, color: "bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800" },
  { value: "editor", label: "Editor", icon: Pencil, color: "bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800" },
]

function getRoleConfig(role: string) {
  return COMMON_ROLES.find(r => r.value === role) || {
    value: role,
    label: role,
    icon: Shield,
    color: "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800"
  }
}

export function TestUsersManager({
  environmentId,
  environmentName,
  testUsers: initialTestUsers,
}: TestUsersManagerProps) {
  const [testUsers, setTestUsers] = useState(initialTestUsers)
  const [open, setOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<TestUser | null>(null)
  const [role, setRole] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [description, setDescription] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setRole("")
    setUsername("")
    setPassword("")
    setDescription("")
    setShowPassword(false)
    setError(null)
    setEditingUser(null)
  }, [])

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      resetForm()
    }
  }, [resetForm])

  const handleEdit = useCallback((user: TestUser) => {
    setEditingUser(user)
    setRole(user.role)
    setUsername(user.username)
    setPassword("")
    setDescription(user.description || "")
    setOpen(true)
  }, [])

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    if (editingUser) {
      const result = await updateTestUser({
        testUserId: editingUser.id,
        role,
        username,
        password: password || undefined,
        description: description || undefined,
      })

      if (result?.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      setTestUsers(testUsers.map(u =>
        u.id === editingUser.id
          ? { ...u, role, username, description: description || undefined }
          : u
      ))
    } else {
      const result = await createTestUser({
        environmentId,
        role,
        username,
        password,
        description: description || undefined,
      })

      if (result?.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      if (result.data) {
        setTestUsers([...testUsers, result.data])
      }
    }

    setOpen(false)
    setLoading(false)
    resetForm()
  }

  const handleDelete = async (userId: string) => {
    const result = await deleteTestUser(userId)
    if (result?.error) {
      return
    }
    setTestUsers(testUsers.filter(u => u.id !== userId))
  }

  const handleToggleEnabled = async (user: TestUser) => {
    setTogglingId(user.id)
    const result = await updateTestUser({
      testUserId: user.id,
      is_enabled: !user.is_enabled,
    })

    if (!result?.error) {
      setTestUsers(testUsers.map(u =>
        u.id === user.id ? { ...u, is_enabled: !u.is_enabled } : u
      ))
    }
    setTogglingId(null)
  }

  const existingRoles = testUsers.map(u => u.role)
  const suggestedRoles = COMMON_ROLES.filter(r => !existingRoles.includes(r.value))

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-3">
      {/* Header - Compact for mobile */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 shrink-0">
            <KeyRound className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-sm leading-tight">Test Users</h4>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">
              Credentials for authenticated tests
            </p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-8 gap-1.5 text-xs font-medium shadow-sm hover:shadow transition-shadow"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add User</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-3 pb-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                <KeyRound className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="text-center">
                <DialogTitle className="text-lg">
                  {editingUser ? "Edit Test User" : "Add Test User"}
                </DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  {editingUser
                    ? "Update credentials for this test user"
                    : `Configure test credentials for ${environmentName}`
                  }
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              {/* Role Selection - Pills on mobile, grid on desktop */}
              <div className="space-y-2.5">
                <Label htmlFor="role" className="text-sm font-medium flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  Role
                </Label>

                {/* Quick select pills */}
                {suggestedRoles.length > 0 && !editingUser && (
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedRoles.slice(0, 4).map((r) => {
                      const Icon = r.icon
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setRole(r.value)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
                            role === r.value
                              ? r.color + " ring-2 ring-offset-1 ring-violet-500/30"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          {r.label}
                        </button>
                      )
                    })}
                  </div>
                )}

                <Input
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value.toLowerCase())}
                  placeholder="e.g., admin, member, viewer"
                  className="h-10"
                  list="role-suggestions"
                />
                <datalist id="role-suggestions">
                  {suggestedRoles.map((r) => (
                    <option key={r.value} value={r.value} />
                  ))}
                </datalist>
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Username / Email
                </Label>
                <Input
                  id="username"
                  type="email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="user@example.com"
                  className="h-10"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    Password
                  </Label>
                  {editingUser && (
                    <span className="text-xs text-muted-foreground">
                      Leave blank to keep current
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUser ? "Enter new password" : "Password"}
                    className="h-10 pr-10"
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Encrypted with AES-256-GCM before storage
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  Description
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Administrator with full access"
                  className="h-10"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !role || !username || (!editingUser && !password)}
                className="flex-1 sm:flex-none min-w-[120px] bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingUser ? "Updating..." : "Adding..."}
                  </>
                ) : (
                  editingUser ? "Update User" : "Add User"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* User List */}
      {testUsers.length > 0 ? (
        <div className="space-y-2">
          {testUsers.map((user) => {
            const roleConfig = getRoleConfig(user.role)
            const RoleIcon = roleConfig.icon
            const isToggling = togglingId === user.id

            return (
              <div
                key={user.id}
                className={`group relative flex items-center gap-3 p-3 rounded-xl border bg-card transition-all duration-200 hover:shadow-md hover:border-border/80 ${
                  !user.is_enabled ? "opacity-60" : ""
                }`}
              >
                {/* Role Badge */}
                <div className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 ${roleConfig.color}`}>
                  <RoleIcon className="h-4 w-4" />
                </div>

                {/* User Info - Flexible */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-xs font-medium ${roleConfig.color} border`}
                    >
                      {user.role}
                    </Badge>
                    {!user.is_enabled && (
                      <Badge variant="secondary" className="text-xs bg-muted">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium mt-0.5 truncate">{user.username}</p>
                  {user.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate hidden sm:block">
                      {user.description}
                    </p>
                  )}
                </div>

                {/* Actions - Always visible on mobile, hover on desktop */}
                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center">
                        <Switch
                          checked={user.is_enabled}
                          onCheckedChange={() => handleToggleEnabled(user)}
                          disabled={isToggling}
                          className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-600 data-[state=checked]:to-purple-600"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {user.is_enabled ? "Disable user" : "Enable user"}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(user)}
                        className="h-8 w-8 opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Edit user
                    </TooltipContent>
                  </Tooltip>

                  <AlertDialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-70 hover:opacity-100 hover:text-destructive transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Delete user
                      </TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Test User</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the test user for role <strong>&quot;{user.role}&quot;</strong>?
                          Stories requiring this role will be skipped during test runs.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(user.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-dashed bg-gradient-to-br from-muted/30 to-muted/10 p-6 text-center">
          {/* Decorative background */}
          <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,transparent,white)] dark:bg-grid-slate-700/25" />

          <div className="relative">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 mb-3">
              <KeyRound className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-sm font-medium text-foreground">
              No test users configured
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">
              Add test credentials to enable authenticated test execution
            </p>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  )
}
