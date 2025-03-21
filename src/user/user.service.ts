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

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: {
        id,
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
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

  findAgentAndLeads(key: string) {
    return this.prisma.user.findMany({
      where: pickBy({
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
  }

  async updatePassword(userId: string, hashedPassword: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }
}