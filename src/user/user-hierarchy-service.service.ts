import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';

export interface UserHierarchyResult {
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  supervisedUsers: {
    id: string;
    name: string;
    email: string;
    role: string;
    supervisor: string;
    level: number; // Depth level in hierarchy
  }[];
  totalCount: number;
  hierarchyType: 'DOWNWARD' | 'UPWARD'; // Indicates if showing supervisees or supervisors
  userLists: string[]; // List of all user IDs in the hierarchy including current user
}


@Injectable()
export class UserHierarchyService {
  constructor(private prisma: PrismaService) {}

  async getUserHierarchy(userId: string): Promise<UserHierarchyResult> {
    // First, get the current user and verify their role
    const currentUser = await this.prisma.user.findUnique({
      where: { 
        id: userId,
        deleted: false // Only active users
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        supervisor: true
      }
    });

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    if (!currentUser.status) {
      throw new ForbiddenException('User account is inactive');
    }

    let relatedUsers: any[] = [];
    let hierarchyType: 'DOWNWARD' | 'UPWARD' = 'DOWNWARD';

    switch (currentUser.role) {
      case 'SUPER_ADMIN':
        // For SuperAdmin, get all users in their hierarchy recursively (downward)
        relatedUsers = await this.getAllSupervisedUsers(userId);
        hierarchyType = 'DOWNWARD';
        break;
        
      case 'ADMIN':
        // For Admin, get only direct supervisees (downward)
        relatedUsers = await this.getDirectSupervisees(userId);
        hierarchyType = 'DOWNWARD';
        break;
        
      case 'LEAD':
      case 'AGENT':
        // For Lead/Agent, get their supervisors and higher hierarchy (upward)
        relatedUsers = await this.getAllSupervisors(userId);
        hierarchyType = 'UPWARD';
        break;
        
      default:
        throw new ForbiddenException('Invalid user role');
    }

	// Create userLists array containing all user IDs (related users + current user)
    const userLists = [
      ...relatedUsers.map(user => user.id),
      currentUser.id
    ];

    return {
      currentUser: {
        id: currentUser.id,
        name: currentUser.name || '',
        email: currentUser.email,
        role: currentUser.role
      },
      supervisedUsers: relatedUsers.map(user => ({
        id: user.id,
        name: user.name || '',
        email: user.email,
        role: user.role,
        supervisor: user.supervisor,
        level: user.level || 1
      })),
      totalCount: relatedUsers.length,
      hierarchyType,
	  userLists
    };
  }

  private async getAllSupervisedUsers(supervisorId: string): Promise<any[]> {
    const allUsers: any[] = [];
    const visited = new Set<string>(); // Prevent infinite loops

    const getChildrenRecursively = async (currentSupervisorId: string, level: number = 1) => {
      if (visited.has(currentSupervisorId)) {
        return; // Prevent circular references
      }
      visited.add(currentSupervisorId);

      // Get direct supervisees
      const directSupervisees = await this.prisma.user.findMany({
        where: {
          supervisor: currentSupervisorId,
          deleted: false,
          status: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          supervisor: true,
          status: true
        }
      });

      for (const user of directSupervisees) {
        // Add current user to results
        allUsers.push({
          ...user,
          level
        });

        // Recursively get their supervisees
        await getChildrenRecursively(user.id, level + 1);
      }
    };

    await getChildrenRecursively(supervisorId);
    return allUsers;
  }

  private async getDirectSupervisees(supervisorId: string): Promise<any[]> {
    const directSupervisees = await this.prisma.user.findMany({
      where: {
        supervisor: supervisorId,
        deleted: false,
        status: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        supervisor: true,
        status: true
      }
    });

    return directSupervisees.map(user => ({
      ...user,
      level: 1
    }));
  }

  private async getAllSupervisors(userId: string): Promise<any[]> {
    const allSupervisors: any[] = [];
    const visited = new Set<string>(); // Prevent infinite loops

    const getSupervisorsRecursively = async (currentUserId: string, level: number = 1) => {
      if (visited.has(currentUserId)) {
        return; // Prevent circular references
      }
      visited.add(currentUserId);

      // Get current user's supervisor
      const currentUser = await this.prisma.user.findUnique({
        where: {
          id: currentUserId,
          deleted: false,
          status: true
        },
        select: {
          supervisor: true
        }
      });

      if (currentUser?.supervisor) {
        // Get supervisor details
        const supervisor = await this.prisma.user.findUnique({
          where: {
            id: currentUser.supervisor,
            deleted: false,
            status: true
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            supervisor: true,
            status: true
          }
        });

        if (supervisor) {
          // Add supervisor to results
          allSupervisors.push({
            ...supervisor,
            level
          });

          // Recursively get their supervisors
          await getSupervisorsRecursively(supervisor.id, level + 1);
        }
      }
    };

    await getSupervisorsRecursively(userId);
    return allSupervisors;
  }

  // Alternative method that gets all users with their hierarchy information
  async getUserHierarchyWithDetails(userId: string): Promise<UserHierarchyResult & { hierarchyTree: any[] }> {
    const result = await this.getUserHierarchy(userId);
    
    if (result.currentUser.role === 'SUPER_ADMIN') {
      const hierarchyTree = await this.buildHierarchyTree(userId);
      return {
        ...result,
        hierarchyTree
      };
    }

    return {
      ...result,
      hierarchyTree: []
    };
  }

  private async buildHierarchyTree(rootId: string): Promise<any[]> {
    const buildTree = async (parentId: string): Promise<any[]> => {
      const children = await this.prisma.user.findMany({
        where: {
          supervisor: parentId,
          deleted: false,
          status: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          supervisor: true
        }
      });

      const childrenWithSubtree = await Promise.all(
        children.map(async (child) => ({
          ...child,
          children: await buildTree(child.id)
        }))
      );

      return childrenWithSubtree;
    };

    return await buildTree(rootId);
  }

  // Method to get user count statistics
  async getUserStatistics(userId: string): Promise<{
    totalSupervised: number;
    byRole: Record<string, number>;
    byLevel: Record<number, number>;
  }> {
    const hierarchy = await this.getUserHierarchy(userId);
    
    const byRole = hierarchy.supervisedUsers.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byLevel = hierarchy.supervisedUsers.reduce((acc, user) => {
      acc[user.level] = (acc[user.level] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return {
      totalSupervised: hierarchy.totalCount,
      byRole,
      byLevel
    };
  }
}
