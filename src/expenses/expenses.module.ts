import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { SessionService } from 'src/session/session.service';

@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService, SessionService]
})
export class ExpensesModule {}
