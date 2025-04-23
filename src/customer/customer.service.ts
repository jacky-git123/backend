import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { CreateCustomerDto, UpdateCustomerDto } from './customer.dto';
import { pickBy } from 'lodash';
import { RunningNumberGenerator } from 'src/common/utils';

@Injectable()
export class CustomerService {
    constructor(private prisma: PrismaService,
      private utilService:RunningNumberGenerator
    ) {}

  async create(data: any) {
    delete data.userid;
    if (data.ic && !data.id) {
      const checkIC = await this.prisma.customer.findFirst({
        where: {
          ic: data.ic
        }
      });

      if (checkIC && !data.id) {
        throw new BadRequestException('IC already exist');
      }
    }


    if(data.passport && !data.id) {
      const checkPass = await this.prisma.customer.findFirst({
        where: {
          passport: data.passport
        }
      });
      if (checkPass) {
        throw new BadRequestException('Passport already exist');
      }
    }

    // console.log(data);
    const { bankDetails, ...customerData } = data;
    if(customerData.id) {
      return this.updateCustomer(customerData, customerData.id);
    } else {
      const generate_id = await this.utilService.generateUniqueNumber('CT');
      return this.addCustomer({ ...customerData, generate_id: generate_id });
    }
  }

  async findAll(skip: number, take: number, filter: any, authUserId: any) {
    if (!authUserId) return;
  
    const authUser = await this.prisma.user.findFirst({
      where: {
        id: authUserId,
      }
    });
    // console.log('authUser', authUser);
    // if (authUser.role === 'SUPER_ADMIN') {}
  
    // Initialize where clause with deleted_at: null
    let where: any = {
      deleted_at: null,
    };
  
    // If user has a supervisor, we need to query customers with that supervisor in leadUser array
    if (authUser.supervisor && authUser.supervisor !== 'SUPER_ADMIN') {
      // Using raw filter for leadUser JSON array
      where = {
        ...where,
        // This raw query handles the array structure of leadUser where lead1 could be in any position
        AND: [
          {
            OR: [
              { created_by: authUserId },
              // Use raw filtering for leadUser array
              { 
                leadUser: {
                  path: ['$[*].lead1'],
                  array_contains: authUser.supervisor
                }
              }
            ]
          }
        ]
      };
    }
    
    // Add text search filters if provided
    if (filter) {
      where = pickBy({
        ...where,
        OR: [
          {
            generate_id: {
              contains: filter,
              mode: "insensitive"
            }
          },
          {
            name: {
              contains: filter,
              mode: "insensitive"
            }
          },
          {
            email: {
              contains: filter,
              mode: "insensitive"
            }
          },
          {
            passport: {
              contains: filter,
              mode: "insensitive"
            }
          },
          {
            ic: {
              contains: filter,
              mode: "insensitive"
            }
          }
        ]
      });
    }
  
    console.log('where');
    console.log(where);
    console.log('where');
  
    // If Prisma's JSON filtering isn't working for the array, use a raw query approach
    let customers, total;
    
    if (authUser.supervisor && authUser.supervisor !== 'SUPER_ADMIN') {
      // Using raw query to handle the JSON array search properly
      const rawQuery = `
        SELECT * FROM "customer"
        WHERE "deleted_at" IS NULL
        AND EXISTS (
          SELECT FROM jsonb_array_elements("leadUser") AS elem
          WHERE elem->>'lead1' = '${authUser.supervisor}'
        )
        ${filter ? `AND (
          LOWER("name") LIKE LOWER('%${filter}%') OR
          LOWER("email") LIKE LOWER('%${filter}%') OR
          LOWER("passport") LIKE LOWER('%${filter}%') OR
          LOWER("ic") LIKE LOWER('%${filter}%')
        )` : ''}
        ORDER BY "created_at" DESC
        LIMIT ${take} OFFSET ${skip}
      `;
  
      const countQuery = `
        SELECT COUNT(*) FROM "customer"
        WHERE "deleted_at" IS NULL
        AND EXISTS (
          SELECT FROM jsonb_array_elements("leadUser") AS elem
          WHERE elem->>'lead1' = '${authUser.supervisor}'
        )
        ${filter ? `AND (
          LOWER("name") LIKE LOWER('%${filter}%') OR
          LOWER("email") LIKE LOWER('%${filter}%') OR
          LOWER("passport") LIKE LOWER('%${filter}%') OR
          LOWER("ic") LIKE LOWER('%${filter}%')
        )` : ''}
      `;
  
      [customers, total] = await Promise.all([
        this.prisma.$queryRawUnsafe(rawQuery),
        this.prisma.$queryRawUnsafe(countQuery)
      ]);
      
      total = Number(total[0].count);
    } else {
      // Use standard Prisma queries when no leadUser filtering is needed
      [customers, total] = await Promise.all([
        this.prisma.customer.findMany({
          skip,
          take,
          where,
          orderBy: {
            created_at: 'desc'
          },
        }),
        this.prisma.customer.count({
          where,
        }),
      ]);
    }
  
    // Enhance customer data with loan status counts
    await Promise.all(customers.map(async (customer:any) => {
      const onGoingStatusCounts = await this.prisma.loan.count({
        where: {
          status: 'Completed',
          customer_id: customer.id,
        }
      });
      const normalStatusCounts = await this.prisma.loan.count({
        where: {
          status: 'Normal',
          customer_id: customer.id,
        }
      });
      const badDebtStatusCounts = await this.prisma.loan.count({
        where: {
          status: 'Bad Debt',
          customer_id: customer.id,
        }
      });
      const badDebtCompletedStatusCounts = await this.prisma.loan.count({
        where: {
          status: 'Bad Debt Completed',
          customer_id: customer.id,
        }
      });
      customer.onGoingStatusCounts = onGoingStatusCounts;
      customer.normalStatusCounts = normalStatusCounts;
      customer.badDebtStatusCounts = badDebtStatusCounts;
      customer.badDebtCompletedStatusCounts = badDebtCompletedStatusCounts;
    }));
  
    return {
      data: customers,
      total,
      skip,
      take,
    };
  }
  
  customPickBy(array) {
    // First, filter out objects with undefined values
    const filteredArray = array.filter(item => {
      // Get the first key of the object
      const key = Object.keys(item)[0];
      // Keep only items where the value is defined
      return item[key] !== undefined;
    });
    
    // Convert filtered array to object with numeric keys
    return filteredArray.reduce((acc, item, index) => {
      acc[index] = item;
      return acc;
    }, {});
  }

  async findOne(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      // include: {
      //   customer_relation: {
      //     include: {
      //       address: true,
      //     }
      //   },
      //   customer_address: true,
      //   company: true,
      // },
    });
  }

  async update(id: string, data: any) {
    const { customer_relation, customer_address, company, bankDetails, ...customerData } = data;
    // data.created_by = data.userid;
    data.updated_by = data.userid;
    delete data.userid;
    return this.prisma.customer.update({
      where: { id },
      data: data,
    });
  }

  async delete(id: string) {
    return this.prisma.customer.update({
      data: { deleted_at: new Date(), deleted: true },
      where: { id },
    });
  }

  async addDocument(data: { id: string; filesData: any[] }) {
    const { id, filesData } = data;
  
    const promises = filesData.map(async (file) => {
      return this.prisma.document.create({
        data: {
          name: file.fileName,
          path: file.fileName,
          customer_id: id, 
          description: file.fileDescription,
          size: file.fileSize.toString(),
        },
      });
    });
  
    return Promise.all(promises);
  }
  

  async addCustomer(data) {
    if (data.customer_address) {
      data.customer_address = JSON.parse(JSON.stringify(data.customer_address));
    }
    if (data.relations) {
      data.relations = JSON.parse(JSON.stringify(data.relations));
    }
    if (data.employment) {
      data.employment = JSON.parse(JSON.stringify(data.employment));
    }
    if (data.bank_details) {
      data.bank_details = JSON.parse(JSON.stringify(data.bank_details));
    }
    return this.prisma.customer.create({
      data: data,
    });
  }

  async updateCustomer(data, id) {
    if (data.customer_address) {
      data.customer_address = JSON.parse(JSON.stringify(data.customer_address));
    }
    if (data.relations) {
      data.relations = JSON.parse(JSON.stringify(data.relations));
    }
    if (data.employment) {
      data.employment = JSON.parse(JSON.stringify(data.employment));
    }
    if (data.bank_details) {
      data.bank_details = JSON.parse(JSON.stringify(data.bank_details));
    }
    return this.prisma.customer.update({
      where: { id },
      data: data,
    });
  }

  getCustomer(key: string) {
    return this.prisma.customer.findMany({
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
          },
          {
            passport: {
              contains: key,
              mode: "insensitive"
            }
          },
          {
            ic: {
              contains: key,
              mode: "insensitive"
            }
          }
        ]
      }),
    });
  }

  getDocument(key: string) {
    return this.prisma.document.findMany({
      where: { customer_id:key },
    });
  }

  async getCustomerStatus(key: string) {
    const customer = await this.prisma.customer.findFirst({
      where: pickBy({
        OR: [
          {
            email: {
              contains: key,
              mode: "insensitive"
            }
          },
          {
            ic: {
              contains: key,
              mode: "insensitive"
            }
          }
        ]
      }),
    });
    // Find Load
    const loanStatusCounts = await this.prisma.loan.groupBy({
      by: ['status', 'supervisor'],
      where: {
        customer_id: customer.id,
      },
      _count: {
        status: true,
        supervisor: true,
      },
    });
    await Promise.all(loanStatusCounts.map(async (loan: any) => {
      const supervisor = await this.prisma.user.findUnique({
        where: {
          id: loan.supervisor
        }
      });
      loan.supervisorObj = supervisor;
      if (loan.supervisor_2) {
        const supervisor_2 = await this.prisma.user.findUnique({
          where: {
            id: loan.supervisor_2
          }
        });
        loan.supervisor_2Obj = supervisor_2;
      }
    }));
    return loanStatusCounts;
  }
  
}
