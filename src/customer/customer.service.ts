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
    let getSupervisor;
    if (authUser.supervisor) {
      getSupervisor = await this.prisma.user.findFirst({
        where: { id: authUser.supervisor }
      });
    }

    // let orClauses = [];
    // orClauses.push({ created_by: authUserId })
    // if (getSupervisor) {
    //   orClauses = [
    //     { supervisor: getSupervisor.id },
    //     { supervisor_2: getSupervisor.id },
    //     { created_by: getSupervisor.id },
    //   ];
    // }

    let where = {
      deleted_at: null,
      // OR: orClauses
    }
    console.log('where');
    console.log(where);
    if (filter) {
      where = pickBy({
        OR: [
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
    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        skip,
        take,
        where,
        orderBy: {
          created_at: 'desc' // Add sorting by created_at in descending order
        },
      }),
      this.prisma.customer.count({
        where,
      }),
    ]);

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

    }))
    // console.log('customerscustomerscustomerscustomerscustomers');
    // console.log(customers);
    // console.log('customerscustomerscustomerscustomerscustomerscustomers');
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
    return this.prisma.customer.update({
      where: { id },
      data: data,
    });
  }

  async delete(id: string) {
    return this.prisma.customer.update({
      data: { deleted_at: new Date() },
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
