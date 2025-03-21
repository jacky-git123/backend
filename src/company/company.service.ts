import { Injectable } from '@nestjs/common';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  create(createCompanyDto: CreateCompanyDto) {
    // return this.prisma.company.create({ data: createCompanyDto });
  }

  findAll() {
    // return this.prisma.company.findMany();
  }

  findOne(id: string) {
    // return this.prisma.company.findUnique({ where: { id } });
  }

  update(id: string, updateCompanyDto: UpdateCompanyDto) {
    // return this.prisma.company.update({
    //   where: { id },
    //   data: updateCompanyDto,
    // });
  }

  remove(id: string) {
    // return this.prisma.company.delete({ where: { id } });
  }
}