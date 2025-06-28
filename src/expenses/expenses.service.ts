import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { CreateExpenseDto } from './dto/expenses.dto';

@Injectable()
export class ExpensesService {
	constructor(private prisma: PrismaService,
	) { }

	async getAllExpensesByCurrentYear(agent_id: string) {
		const currentYear = new Date().getFullYear().toString();

		return this.prisma.expenses.findMany({
			where: {
				year: currentYear,
				deleted: false,
				user_id: agent_id,
			},
			orderBy: {
				created_at: 'desc',
			},
		});
	}

	async createExpense(createExpenseDto: CreateExpenseDto[]) {
		return this.prisma.expenses.createMany({
			data: createExpenseDto,
		});
	}
}
