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
      orderBy: {
        created_at: 'desc',
      },
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

  async findAllLeads() {
    return this.prisma.user.findMany({
      where:{'role':'LEAD'},
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
    delete updateUserDto.password;
    delete updateUserDto.userid;
    return this.prisma.user.update({ where: { id }, data: updateUserDto });
  }

  async remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
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
    if (user && user.password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (isPasswordValid) {
        const { password, ...result } = user;
        return result; // Exclude password before returning
      }
    }
    return null;
  }

  async findAgentAndLeads(key: string) {
    const data = await this.prisma.user.findMany({
      where: pickBy({
        deleted: false,
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
