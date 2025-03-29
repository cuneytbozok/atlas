"use client";

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LucideUsers, LucideUserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface TeamMember {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  role: {
    id: string;
    name: string;
  };
}

interface TeamMembersCardProps {
  members: TeamMember[];
  onManageTeam: () => void;
  projectManager?: TeamMember | null;
}

// Helper function to get initials from name or email
const getInitials = (name: string | null, email: string): string => {
  if (name) {
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
};

// Helper function to check if a member is the project manager
const isProjectManager = (member: TeamMember, projectManager: TeamMember | null | undefined): boolean => {
  if (!projectManager) return false;
  return member.id === projectManager.id;
};

export function TeamMembersCard({ members, onManageTeam, projectManager }: TeamMembersCardProps) {
  const [showAll, setShowAll] = useState(false);
  
  // Filter out the project manager first
  const projectManagerMember = projectManager || null;
  const regularMembers = projectManager 
    ? members.filter(member => member.id !== projectManager.id)
    : members;
  
  // Limit displayed members if not showing all
  const displayedMembers = showAll ? regularMembers : regularMembers.slice(0, 4);
  const hasMoreMembers = regularMembers.length > 4;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="mb-2">
          <LucideUsers className="h-5 w-5 text-muted-foreground" />
        </div>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Team Members</span>
          <Badge variant="outline" className="ml-2">
            {members.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Project Manager */}
          {projectManagerMember && (
            <div className="border-b pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {projectManagerMember.user.image ? (
                    <AvatarImage 
                      src={projectManagerMember.user.image} 
                      alt={projectManagerMember.user.name || projectManagerMember.user.email} 
                    />
                  ) : (
                    <AvatarFallback>
                      {getInitials(projectManagerMember.user.name, projectManagerMember.user.email)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{projectManagerMember.user.name || projectManagerMember.user.email}</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">PM</Badge>
                  </div>
                  {projectManagerMember.user.name && (
                    <span className="text-xs text-muted-foreground">{projectManagerMember.user.email}</span>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Team Members */}
          {displayedMembers.length > 0 ? (
            <div className="space-y-3">
              {displayedMembers.map(member => (
                <div key={member.id} className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {member.user.image ? (
                      <AvatarImage 
                        src={member.user.image} 
                        alt={member.user.name || member.user.email} 
                      />
                    ) : (
                      <AvatarFallback>
                        {getInitials(member.user.name, member.user.email)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <span className="text-sm">{member.user.name || member.user.email}</span>
                    {member.user.name && (
                      <div className="text-xs text-muted-foreground">{member.user.email}</div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Show more button */}
              {!showAll && hasMoreMembers && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs w-full mt-1"
                  onClick={() => setShowAll(true)}
                >
                  Show {regularMembers.length - 4} more members
                </Button>
              )}
              
              {/* Show less button */}
              {showAll && hasMoreMembers && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs w-full mt-1"
                  onClick={() => setShowAll(false)}
                >
                  Show less
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No additional team members</p>
          )}

          {/* Visual Representation */}
          {members.length > 0 && (
            <div className="pt-4">
              <div className="flex items-center space-x-1 mb-1.5">
                <span className="text-xs font-medium">Team Size</span>
                <span className="text-xs text-muted-foreground ml-auto">{members.length} members</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full" 
                  style={{ 
                    width: `${Math.min(100, members.length * 10)}%`,
                    // If more than 10 members, cap at 100%
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={onManageTeam}
        >
          <LucideUserPlus className="h-4 w-4 mr-2" />
          Manage Team
        </Button>
      </CardFooter>
    </Card>
  );
} 