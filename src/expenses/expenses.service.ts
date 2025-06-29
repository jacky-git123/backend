import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { CreateExpenseDto } from './dto/expenses.dto';

@Injectable()
export class ExpensesService {
	constructor(private prisma: PrismaService,
	) { }

	async getAllExpensesByYear(agent_id: string[], year: string) {
		return this.prisma.expenses.findMany({
		  where: {
			year,
			deleted: false,
			user_id: { in: agent_id },
		  },
		  orderBy: {
			created_at: 'desc',
		  },
		});
	  }
	  

	  async findByUserIdAndYear(userId: string, year: string) {
		return this.prisma.expenses.findFirst({
		  where: {
			user_id: userId,
			year: year,
		  },
		});
	  }
	  
	  async createExpense(createExpenseDto: CreateExpenseDto) {
		return this.prisma.expenses.create({
		  data: createExpenseDto,
		});
	  }
	  
	  async updateExpense(id: string, updateExpenseDto: CreateExpenseDto) {
		return this.prisma.expenses.update({
		  where: { id },
		  data: updateExpenseDto,
		});
	  }
	  
}
