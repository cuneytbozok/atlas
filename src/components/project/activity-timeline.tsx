"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import {
  LucideFile,
  LucideUsers,
  LucideMessageSquare,
  LucideRefreshCw,
  LucideTrash,
  LucideUpload,
  LucidePencil,
  LucideUserPlus,
  LucideUserMinus,
  LucideActivity,
} from "lucide-react";

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Activity {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  user: User;
  context?: any;
}

interface ActivityTimelineProps {
  projectId: string;
  limit?: number;
}

// Helper function to get initials from name or email
const getInitials = (user: User): string => {
  if (user.name) {
    const parts = user.name.split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  }
  return user.email.substring(0, 2).toUpperCase();
};

// Helper function to get an icon for an activity based on action and entityType
const getActivityIcon = (activity: Activity) => {
  const { action, entityType } = activity;
  
  if (entityType === 'FILE') {
    if (action === 'UPLOAD_FILE') return <LucideUpload className="h-4 w-4 text-primary" />;
    if (action === 'DELETE_FILE') return <LucideTrash className="h-4 w-4 text-destructive" />;
    return <LucideFile className="h-4 w-4" />;
  }
  
  if (entityType === 'THREAD') {
    return <LucideMessageSquare className="h-4 w-4 text-primary" />;
  }
  
  if (entityType === 'PROJECT_MEMBER') {
    if (action === 'ADD_MEMBER') return <LucideUserPlus className="h-4 w-4 text-success" />;
    if (action === 'REMOVE_MEMBER') return <LucideUserMinus className="h-4 w-4 text-destructive" />;
    return <LucideUsers className="h-4 w-4" />;
  }
  
  if (entityType === 'PROJECT') {
    if (action === 'UPDATE_PROJECT') return <LucidePencil className="h-4 w-4 text-primary" />;
    if (action === 'UPDATE_PROJECT_NAME') return <LucidePencil className="h-4 w-4 text-primary" />;
    if (action === 'UPDATE_PROJECT_DESCRIPTION') return <LucidePencil className="h-4 w-4 text-primary" />;
    if (action === 'CHANGE_STATUS') return <LucidePencil className="h-4 w-4 text-yellow-500" />;
    if (action === 'ASSIGN_PROJECT_MANAGER') return <LucideUserPlus className="h-4 w-4 text-indigo-500" />;
    if (action === 'REMOVE_PROJECT_MANAGER') return <LucideUserMinus className="h-4 w-4 text-indigo-500" />;
    return <LucideActivity className="h-4 w-4" />;
  }
  
  return <LucideActivity className="h-4 w-4" />;
};

// Helper function to generate a human-readable description of the activity
const getActivityDescription = (activity: Activity): string => {
  const { action, entityType, context } = activity;
  const userName = activity.user.name || activity.user.email;
  
  if (entityType === 'FILE') {
    const fileName = context?.file?.name || 'a file';
    if (action === 'UPLOAD_FILE') return `${userName} uploaded ${fileName}`;
    if (action === 'DELETE_FILE') return `${userName} deleted ${fileName}`;
    return `${userName} modified ${fileName}`;
  }
  
  if (entityType === 'THREAD') {
    const threadTitle = context?.thread?.title || 'a new conversation';
    if (action === 'CREATE_THREAD') return `${userName} started ${threadTitle}`;
    return `${userName} updated a conversation`;
  }
  
  if (entityType === 'PROJECT_MEMBER') {
    const memberName = context?.member?.user?.name || context?.member?.user?.email || 'a team member';
    const roleName = context?.member?.role?.name || 'member';
    
    if (action === 'ADD_MEMBER') return `${userName} added ${memberName} as ${roleName}`;
    if (action === 'REMOVE_MEMBER') return `${userName} removed ${memberName}`;
    return `${userName} updated team members`;
  }
  
  if (entityType === 'PROJECT') {
    if (action === 'UPDATE_PROJECT') return `${userName} updated project details`;
    if (action === 'UPDATE_PROJECT_NAME') return `${userName} changed project name`;
    if (action === 'UPDATE_PROJECT_DESCRIPTION') return `${userName} updated project description`;
    if (action === 'CHANGE_STATUS') return `${userName} changed project status`;
    if (action === 'ASSIGN_PROJECT_MANAGER') return `${userName} assigned a new project manager`;
    if (action === 'REMOVE_PROJECT_MANAGER') return `${userName} removed the project manager`;
    return `${userName} modified the project`;
  }
  
  return `${userName} performed an action`;
};

export function ActivityTimeline({ projectId, limit = 5 }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const displayLimit = showAll ? 20 : limit;
  
  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/projects/${projectId}/activity?limit=${displayLimit}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch project activities');
      }
      
      const data = await response.json();
      setActivities(data.activities);
    } catch (err) {
      console.error('Error fetching project activities:', err);
      setError('Failed to load activities');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchActivities();
  }, [projectId, displayLimit]);
  
  const handleRefresh = () => {
    fetchActivities();
  };
  
  const handleViewMore = () => {
    setShowAll(true);
  };
  
  if (isLoading) {
    return (
      <Card className="h-full bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
        <CardHeader className="pb-2">
          <div className="mb-2">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full w-fit">
              <LucideActivity className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-base text-blue-800 dark:text-blue-300">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="h-full bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
        <CardHeader className="pb-2">
          <div className="mb-2">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full w-fit">
              <LucideActivity className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-base text-blue-800 dark:text-blue-300">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-6 text-center text-muted-foreground">
            <p>{error}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={handleRefresh}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="h-full bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      <CardHeader className="pb-2">
        <div className="mb-2">
          <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full w-fit">
            <LucideActivity className="h-10 w-10 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <CardTitle className="text-base text-blue-800 dark:text-blue-300">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute top-0 bottom-0 left-[7px] border-l border-dashed border-blue-200 dark:border-blue-800"></div>
            <div className="space-y-5">
              {activities.map((activity, i) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="h-3.5 w-3.5 rounded-full bg-blue-500 dark:bg-blue-400"></div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      {getActivityIcon(activity)}
                      <span className="text-sm font-medium">{getActivityDescription(activity)}</span>
                      <time className="text-xs text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </time>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 