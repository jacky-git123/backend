import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/expenses.dto';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('current-year')
  async getAllExpensesByCurrentYear(
	@Query('agent_id') agent_id: string[] | string,
	@Query('year') year: string,
	@Query('userid') userid: string
  ) {
	try {
	  // Normalize agent_id to an array
	  const agentIds = Array.isArray(agent_id)
		? agent_id
		: typeof agent_id === 'string'
		  ? agent_id.split(',')  // handles comma-separated values too
		  : [];
  
	  const expenses = await this.expensesService.getAllExpensesByYear(agentIds, year);
  
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
async createOrUpdateExpense(@Body() payload: any) {
  try {
    const createExpenseDto = payload[0]; // Get the actual data
    const agentUserId = createExpenseDto.user_id;
    const year = createExpenseDto.year;

    const existingExpense = await this.expensesService.findByUserIdAndYear(agentUserId, year);

    let result;

    if (existingExpense) {
      result = await this.expensesService.updateExpense(existingExpense.id, createExpenseDto);
    } else {
      result = await this.expensesService.createExpense(createExpenseDto);
    }

    return {
      success: true,
      data: result,
      message: existingExpense ? 'Expense updated successfully' : 'Expense created successfully',
    };
  } catch (error) {
    throw new HttpException(
      {
        success: false,
        message: 'Failed to process expense',
        error: error.message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

}
