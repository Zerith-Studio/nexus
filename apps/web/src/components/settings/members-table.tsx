"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontalIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/session-context";
import { useChangeMemberRole, useMembers, useRemoveMember } from "@/hooks/use-organization-members";
import type { OrgRole } from "@/lib/types";

const ASSIGNABLE_ROLES: OrgRole[] = ["OWNER", "ADMIN", "MEMBER"];

export function MembersTable({ organizationId }: { organizationId: string }) {
  const { user, currentOrganization } = useSession();
  const members = useMembers(organizationId);
  const changeMemberRole = useChangeMemberRole(organizationId);
  const removeMember = useRemoveMember(organizationId);
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; label: string } | null>(null);

  const canManage = currentOrganization.role === "OWNER" || currentOrganization.role === "ADMIN";
  const isOwner = currentOrganization.role === "OWNER";
  const rows = members.data?.data ?? [];

  async function confirmRemove() {
    if (!removeTarget) return;
    try {
      await removeMember.mutateAsync(removeTarget.userId);
      toast.success("Member removed");
      setRemoveTarget(null);
    } catch {
      toast.error("Couldn't remove member. Please try again.");
    }
  }

  if (members.isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    );
  }

  if (members.isError) {
    return <ErrorState description="We couldn't load organization members." onRetry={() => members.refetch()} />;
  }

  if (rows.length === 0) {
    return <EmptyState icon={UsersIcon} title="No members yet" description="Invite teammates to give them access to this organization." />;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {canManage && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((member) => {
            const isSelf = member.userId === user.id;
            const canModifyThisMember = canManage && (isOwner || member.role !== "OWNER");
            return (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-7">
                      <AvatarFallback>{(member.name ?? member.email).slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.name ?? member.email} {isSelf && <span className="text-muted-foreground">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="uppercase">
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                </TableCell>
                {canManage && (
                  <TableCell>
                    {canModifyThisMember && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Member actions">
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {ASSIGNABLE_ROLES.filter((role) => role !== member.role && (isOwner || role !== "OWNER")).map(
                            (role) => (
                              <DropdownMenuItem
                                key={role}
                                onSelect={() =>
                                  toast.promise(changeMemberRole.mutateAsync({ userId: member.userId, role }), {
                                    loading: "Updating role…",
                                    success: `Role updated to ${role}`,
                                    error: "Couldn't update role",
                                  })
                                }
                              >
                                Make {role.toLowerCase()}
                              </DropdownMenuItem>
                            ),
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() =>
                              setRemoveTarget({ userId: member.userId, label: member.name ?? member.email })
                            }
                          >
                            Remove from organization
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove member"
        description={
          <>
            <strong className="text-foreground">{removeTarget?.label}</strong> will lose access to this
            organization immediately. This cannot be undone.
          </>
        }
        confirmLabel="Remove"
        onConfirm={() => void confirmRemove()}
        isPending={removeMember.isPending}
      />
    </>
  );
}
