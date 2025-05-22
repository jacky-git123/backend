import { Injectable } from '@nestjs/common';
import { pickBy } from 'lodash';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'nestjs-prisma';
import * as bcrypt from 'bcrypt';
import { RunningNumberGenerator } from 'src/common/utils';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService,
      private utilService:RunningNumberGenerator
  ) {}

  async findAll(page: number = 0, limit: number = 10, filter: any, authUserId: any) {
    const skip = (page - 1) * limit;
    const data = await this.prisma.user.findMany({
      skip,
      take: limit,
      orderBy: [
        {
          status: 'desc',  // false values come before true values in ascending order
        },
        {
          created_at: 'desc',
        }
      ],
      where: pickBy({
        deleted: false,
      }),
    });

    const total = await this.prisma.user.count({
      where: pickBy({
        deleted: false,
      }),
    });
    return {
      data,
      total,
      skip: Number(page),
      take: Number(limit),
    };
  }

  async findAllActive(page: number = 1, limit: number = 10, filter: any, authUserId: any) {
    const skip = (page - 1) * limit;
  
    const data = await this.prisma.user.findMany({
      skip,
      take: limit,
      orderBy: [
        {
          created_at: 'desc',
        }
      ],
      where: {
        deleted: false,
        status: true,
        role: {
          in: ['AGENT', 'LEAD'],
        },
        ...filter,
      },
    });
  
    const total = await this.prisma.user.count({
      where: {
        deleted: false,
        status: true,
        role: {
          in: ['AGENT', 'LEAD'],
        },
        ...filter,
      },
    });
  
    return {
      data,
      total,
      skip,
      take: limit,
    };
  }
  

  async findAllLeads() {
    return this.prisma.user.findMany({
      where:{'role':'LEAD'},
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async getAdminsAndLeads() {
    return this.prisma.user.findMany({
      where: {
        status: true,
        deleted: false,
        role: {
          in: ['ADMIN', 'LEAD'],
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }  

  async findOne(id: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    delete updateUserDto.userid;

  // Hash the password if it's provided
  if (updateUserDto.password) {
    updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
  } else {
    delete updateUserDto.password;
  }
    return this.prisma.user.update({ where: { id }, data: updateUserDto });
  }

  async remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email, status: true, deleted: false } });
  }

  async createUser(payload): Promise<any> {
    const hashedPassword = await bcrypt.hash(payload.password, 10);
    const generate_id = await this.utilService.generateUniqueNumber('US');
    console.log(generate_id,'gen')
    return this.prisma.user.create({
      data: {
        generate_id:generate_id,
        name: payload.name,
        email: payload.email,
        password: hashedPassword,
        role: payload.role ? payload.role : 'AGENT',
        supervisor: payload.supervisor,
        status:payload.status
      },
    });
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.findByEmail(email);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const now = new Date();
    const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
    const ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 minutes window for attempts


    if (user.password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (isPasswordValid) {
        // Successful login - reset all attempt tracking
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            login_attempt: null,
            first_failed_attempt: null,
            locked_until: null
          }
        });

        const { password, ...result } = user;
        return result;
      } else {
        // Failed login - handle attempt tracking with time window
        const currentAttempts = user.login_attempt || 0;
        const firstFailedAttempt = user.first_failed_attempt;

        // Check if this is the first failed attempt or if we're within the time window
        if (!firstFailedAttempt || (now.getTime() - firstFailedAttempt.getTime()) > ATTEMPT_WINDOW) {
          // Reset the attempt window
          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              login_attempt: 1,
              first_failed_attempt: now
            }
          });

          throw new Error('Invalid credentials. 2 attempt(s) remaining before account lockout.');
        } else {
          // Within the time window, increment attempts
          const newAttempts = currentAttempts + 1;

          if (newAttempts > 3) {
            // Lock the user account
            const lockUntil = new Date(now.getTime() + LOCKOUT_DURATION);

            await this.prisma.user.update({
              where: { id: user.id },
              data: {
                login_attempt: newAttempts,
                status: false,
                // locked_until: lockUntil
              }
            });

            throw new Error('Account has been blocked due to 3 unsuccessful login attempts. Please contact Admin.');
          } else {
            // Update login attempts count and show warning
            await this.prisma.user.update({
              where: { id: user.id },
              data: { login_attempt: newAttempts }
            });

            const remainingAttempts = 3 - newAttempts;

            throw new Error(`Invalid credentials. ${remainingAttempts} attempt(s) remaining before account lockout.`);
          }
        }
      }
    }

    return null
  }

  async findAgentAndLeads(key: string) {
    const data = await this.prisma.user.findMany({
      where: pickBy({
        deleted: false,
        status: true,
        OR: [
          {
            name: {
              contains: key,
              mode: "insensitive"
            }
          },
          {
            email: {
              contains: key,
              mode: "insensitive"
            }
          }
        ],
      }),
    });
    const total = await this.prisma.user.count({
      where: pickBy({
        deleted: false,
        status: true,
        OR: [
          {
            generate_id: {
              contains: key,
              mode: "insensitive"
            }
          },
          {
            name: {
              contains: key,
              mode: "insensitive"
            }
          },
          {
            email: {
              contains: key,
              mode: "insensitive"
            }
          }
        ],
      }),
    });
    return {
      data,
      total,
    };
  }

  async updatePassword(userId: string, hashedPassword: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }
}
