import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
  userLists: {
    id: string;
    name: string;
    email: string;
    role?: string;
  }[]; // List of all user objects in the hierarchy including current user
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

    // Create userLists array containing all user objects (related users + current user)
    const userLists = [
      ...relatedUsers.map(user => ({
        id: user.id,
        name: user.name || '',
        email: user.email,
        role: user.role
      })),
      {
        id: currentUser.id,
        name: currentUser.name || '',
        email: currentUser.email,
        role: currentUser.role
      }
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

  async getLeadsAndAgentsByHierarchy(userId: string): Promise<{
    users: {
      id: string;
      name: string;
      email: string;
      role: string;
      generate_id: string;
      supervisor: string;
    }[];
    totalCount: number;
    requestedBy: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }> {
    // First, get the requesting user to understand their role and permissions
    const requestingUser = await this.prisma.user.findUnique({
      where: {
        id: userId,
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

    if (!requestingUser) {
      throw new NotFoundException('User not found or inactive');
    }

    let users: any[] = [];

    // Apply logic based on the requesting user's role
    switch (requestingUser.role) {
      case 'SUPER_ADMIN':
        // Super admin can see all LEAD and AGENT users
        users = await this.prisma.user.findMany({
          where: {
            role: { in: ['LEAD', 'AGENT'] },
            deleted: false,
            status: true
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            generate_id: true,
            supervisor: true
          }
        });
        break;

      case 'ADMIN':
        // Admin returns LEAD and AGENTS of those LEADS under their hierarchy
        const adminDirectLeads = await this.prisma.user.findMany({
          where: {
            supervisor: userId,
            role: 'LEAD',
            deleted: false,
            status: true
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            generate_id: true,
            supervisor: true
          }
        });

        // Get all AGENTS under these LEADS
        const leadIds = adminDirectLeads.map(lead => lead.id);
        const agentsUnderLeads = await this.prisma.user.findMany({
          where: {
            supervisor: { in: leadIds },
            role: 'AGENT',
            deleted: false,
            status: true
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            generate_id: true,
            supervisor: true
          }
        });

        users = [...adminDirectLeads, ...agentsUnderLeads];
        break;

      case 'LEAD':
        // Lead returns only their AGENTS
        users = await this.prisma.user.findMany({
          where: {
            supervisor: userId,
            role: 'AGENT',
            deleted: false,
            status: true
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            generate_id: true,
            supervisor: true
          }
        });
        break;

      case 'AGENT':
        // Agent returns only their own data
        users = await this.prisma.user.findMany({
          where: {
            id: userId,
            deleted: false,
            status: true
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            generate_id: true,
            supervisor: true
          }
        });
        break;

      default:
        throw new ForbiddenException('Invalid user role');
    }

    // Sort users: LEAD first, then AGENT, then by name
    users.sort((a, b) => {
      if (a.role === 'LEAD' && b.role === 'AGENT') return -1;
      if (a.role === 'AGENT' && b.role === 'LEAD') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    return {
      users: users.map(user => ({
        id: user.id,
        name: user.name || '',
        email: user.email,
        role: user.role,
        generate_id: user.generate_id || '',
        supervisor: user.supervisor || ''
      })),
      totalCount: users.length,
      requestedBy: {
        id: requestingUser.id,
        name: requestingUser.name || '',
        email: requestingUser.email,
        role: requestingUser.role
      }
    };
  }

  // New method: Get agents by multiple LEAD IDs
  async getAgentsByMultipleLeads(leadIds: string[], requestingUserId: string): Promise<{
    agents: {
      id: string;
      name: string;
      email: string;
      role: string;
      generate_id: string;
      supervisor: string;
      supervisorName: string;
    }[];
    leads: {
      id: string;
      name: string;
      email: string;
      generate_id: string;
    }[];
    totalAgents: number;
    totalLeads: number;
    requestedBy: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }> {
    // Validate input
    if (!leadIds || leadIds.length === 0) {
      throw new BadRequestException('Lead IDs array cannot be empty');
    }

    // Get the requesting user
    const requestingUser = await this.prisma.user.findUnique({
      where: {
        id: requestingUserId,
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

    if (!requestingUser) {
      throw new NotFoundException('Requesting user not found or inactive');
    }

    // Validate that the provided lead IDs are actually LEAD users and active
    const validLeads = await this.prisma.user.findMany({
      where: {
        id: { in: leadIds },
        role: 'LEAD',
        deleted: false,
        status: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        generate_id: true,
        supervisor: true
      }
    });

    const validLeadIds = validLeads.map(lead => lead.id);
    const invalidLeadIds = leadIds.filter(id => !validLeadIds.includes(id));

    if (invalidLeadIds.length > 0) {
      throw new BadRequestException(
        `Invalid or inactive LEAD IDs: ${invalidLeadIds.join(', ')}`
      );
    }

    // Check permissions based on requesting user's role
    let authorizedLeadIds: string[] = [];

    switch (requestingUser.role) {
      case 'SUPER_ADMIN':
        // Super admin can access agents under any lead
        authorizedLeadIds = validLeadIds;
        break;

      case 'ADMIN':
        // Admin can only access agents under leads in their hierarchy
        const adminDirectLeads = await this.prisma.user.findMany({
          where: {
            supervisor: requestingUserId,
            role: 'LEAD',
            deleted: false,
            status: true
          },
          select: { id: true }
        });

        const adminLeadIds = adminDirectLeads.map(lead => lead.id);
        authorizedLeadIds = validLeadIds.filter(id => adminLeadIds.includes(id));

        if (authorizedLeadIds.length !== validLeadIds.length) {
          const unauthorizedIds = validLeadIds.filter(id => !authorizedLeadIds.includes(id));
          throw new ForbiddenException(
            `Access denied to leads: ${unauthorizedIds.join(', ')}`
          );
        }
        break;

      case 'LEAD':
        // Lead can only access their own agents
        if (validLeadIds.length !== 1 || !validLeadIds.includes(requestingUserId)) {
          throw new ForbiddenException('LEADs can only access their own agents');
        }
        authorizedLeadIds = [requestingUserId];
        break;

      default:
        throw new ForbiddenException('Insufficient permissions to access this data');
    }

    // Get all agents under the authorized leads
    const agents = await this.prisma.user.findMany({
      where: {
        supervisor: { in: authorizedLeadIds },
        role: 'AGENT',
        deleted: false,
        status: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        generate_id: true,
        supervisor: true
      },
      orderBy: [
        { name: 'asc' }
      ]
    });

    // Create a map of lead names for supervisor information
    const leadNameMap = validLeads.reduce((map, lead) => {
      map[lead.id] = lead.name || lead.email;
      return map;
    }, {} as Record<string, string>);

    return {
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name || '',
        email: agent.email,
        role: agent.role,
        generate_id: agent.generate_id || '',
        supervisor: agent.supervisor || '',
        supervisorName: leadNameMap[agent.supervisor || ''] || 'Unknown'
      })),
      leads: validLeads.filter(lead => authorizedLeadIds.includes(lead.id)).map(lead => ({
        id: lead.id,
        name: lead.name || '',
        email: lead.email,
        generate_id: lead.generate_id || ''
      })),
      totalAgents: agents.length,
      totalLeads: authorizedLeadIds.length,
      requestedBy: {
        id: requestingUser.id,
        name: requestingUser.name || '',
        email: requestingUser.email,
        role: requestingUser.role
      }
    };
  }

  // Alternative simpler version if you just want all LEAD and AGENT users without hierarchy filtering

  async getAllLeadsAndAgents(): Promise<{
    users: {
      id: string;
      name: string;
      email: string;
      role: string;
      generate_id: string;
      supervisor: string;
    }[];
    totalCount: number;
  }> {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: ['LEAD', 'AGENT'] },
        deleted: false,
        status: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        generate_id: true,
        supervisor: true
      },
      orderBy: [
        { role: 'asc' }, // AGENT first, then LEAD
        { name: 'asc' }
      ]
    });

    return {
      users: users.map(user => ({
        id: user.id,
        name: user.name || '',
        email: user.email,
        role: user.role,
        generate_id: user.generate_id || '',
        supervisor: user.supervisor || ''
      })),
      totalCount: users.length
    };
  }
}
