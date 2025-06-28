import { Body, Controller, Get, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/expenses.dto';

@Controller('expenses')
export class ExpensesController {
	constructor(private readonly expensesService: ExpensesService) { }

	@Get('current-year')
	async getAllExpensesByCurrentYear(
		@Query('agent_id') agent_id: string,
	) {
		try {
			const expenses = await this.expensesService.getAllExpensesByCurrentYear(agent_id);
			return {
				success: true,
				data: expenses,
				message: 'Expenses retrieved successfully',
			};
		} catch (error) {
			throw new HttpException(
				{
					success: false,
					message: 'Failed to retrieve expenses',
					error: error.message,
				},
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}

	@Post()
	async createExpense(@Body() createExpenseDto: CreateExpenseDto[]) {
		try {
			const newExpense = await this.expensesService.createExpense(createExpenseDto);
			return {
				success: true,
				data: newExpense,
				message: 'Expense created successfully',
			};
		} catch (error) {
			throw new HttpException(
				{
					success: false,
					message: 'Failed to create expense',
					error: error.message,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
