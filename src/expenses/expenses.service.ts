import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { CreateExpenseDto } from './dto/expenses.dto';

@Injectable()
export class ExpensesService {
	constructor(private prisma: PrismaService,
	) { }

	async getAllExpensesByCurrentYear() {
		const currentYear = new Date().getFullYear().toString();

		return this.prisma.expenses.findMany({
			where: {
				year: currentYear,
				deleted: false,
			},
			orderBy: {
				created_at: 'desc',
			},
		});
	}

	async createExpense(createExpenseDto: CreateExpenseDto) {
    const currentYear = new Date().getFullYear().toString();
    
    // If year is not provided, use current year
    const expenseData = {
      ...createExpenseDto,
      year: createExpenseDto.year || currentYear,
    };

    return this.prisma.expenses.create({
      data: expenseData,
    });
  }
}
